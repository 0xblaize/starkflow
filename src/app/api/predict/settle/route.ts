/**
 * POST /api/predict/settle
 *
 * Settlement engine for 24h prediction markets.
 * Called by a Vercel Cron every hour (see vercel.json).
 *
 * For each OPEN bet whose cycleExpiresAt has passed, this route:
 *  1. Fetches the latest oracle price for the bet's baseAsset.
 *  2. Compares it against the bet's stored targetPrice.
 *  3. Determines WON / LOST based on the operator stored in the market definition.
 *  4. Computes informational payout (stake / entryProbability for WON bets).
 *  5. Writes status, settlementPrice, payoutAmount, resolvedAt to the DB.
 *
 * Auth: Bearer token must match process.env.CRON_SECRET.
 * ONCHAIN payouts (claim_winnings on Starknet escrow) are intentionally
 * left as a separate manual/user-triggered flow for Phase 1.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPredictMarketDefinition } from "@/lib/predict-markets";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import type { PredictAsset } from "@/lib/predict-markets";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, only allow in local dev.
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return token === cronSecret;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumericSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Determine WON / LOST given the market operator, the stored outcome the
 * user bet on, and the settlement oracle price vs the target.
 */
function resolveOutcome(
  operator: "above" | "below",
  userOutcome: string,
  settlementPrice: number,
  targetPrice: number,
): "WON" | "LOST" {
  // Did the price actually cross the target in the expected direction?
  const priceHitTarget =
    operator === "above"
      ? settlementPrice >= targetPrice
      : settlementPrice <= targetPrice;

  // If the user bet YES → they win when the price hit the target.
  // If the user bet NO  → they win when the price did NOT hit the target.
  const userWon =
    userOutcome === "YES" ? priceHitTarget : !priceHitTarget;

  return userWon ? "WON" : "LOST";
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();

  // Find all OPEN bets whose 24h window has closed.
  // Include bets with no cycleExpiresAt but older than 24h (legacy bets).
  const expiredBets = await prisma.predictionBet.findMany({
    where: {
      status: "OPEN",
      OR: [
        { cycleExpiresAt: { lte: now } },
        {
          cycleExpiresAt: null,
          createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1_000) },
        },
      ],
    },
    select: {
      id: true,
      baseAsset: true,
      entryProbabilityBps: true,
      marketId: true,
      outcome: true,
      stakeAmount: true,
      targetPrice: true,
      volatilityBps: true,
    },
    take: 100, // process max 100 per cron run to stay within timeout
  });

  if (expiredBets.length === 0) {
    return NextResponse.json({ settled: 0, message: "No expired bets to settle." });
  }

  // Collect the unique assets we need oracle prices for.
  const uniqueAssets = [
    ...new Set(expiredBets.map((bet) => bet.baseAsset as PredictAsset)),
  ];

  let priceSnapshots: Record<PredictAsset, { priceUsd: number | null }>;

  try {
    priceSnapshots = await getLatestPredictPrices(uniqueAssets);
  } catch (error) {
    console.error("[/api/predict/settle] Oracle fetch failed:", error);
    return NextResponse.json(
      { error: "Oracle price fetch failed; settlement deferred." },
      { status: 503 },
    );
  }

  // ---------------------------------------------------------------------------
  // Settle each bet
  // ---------------------------------------------------------------------------

  let settledCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  const errors: string[] = [];

  for (const bet of expiredBets) {
    try {
      const market = getPredictMarketDefinition(bet.marketId);

      if (!market) {
        errors.push(`${bet.id}: unknown market ${bet.marketId}`);
        continue;
      }

      const settlementPriceRaw =
        priceSnapshots[bet.baseAsset as PredictAsset]?.priceUsd ?? null;

      if (settlementPriceRaw == null) {
        // Oracle unavailable for this asset — skip and retry next hour.
        errors.push(`${bet.id}: no oracle price for ${bet.baseAsset}`);
        continue;
      }

      const targetPrice = parseNumericSafe(bet.targetPrice);

      if (targetPrice == null || targetPrice <= 0) {
        errors.push(`${bet.id}: invalid stored targetPrice ${bet.targetPrice}`);
        continue;
      }

      const result = resolveOutcome(
        market.operator,
        bet.outcome,
        settlementPriceRaw,
        targetPrice,
      );

      // Payout calculation (informational — no USDC transfer in Phase 1).
      let payoutAmount = "0.00";

      if (result === "WON") {
        const stakeValue = parseNumericSafe(bet.stakeAmount) ?? 0;
        const entryProbFraction =
          bet.entryProbabilityBps != null && bet.entryProbabilityBps > 0
            ? bet.entryProbabilityBps / 10_000
            : 0.5; // fallback 50%
        const payout = stakeValue / Math.max(entryProbFraction, 0.01);
        payoutAmount = payout.toFixed(2);
        wonCount++;
      } else {
        lostCount++;
      }

      await prisma.predictionBet.update({
        where: { id: bet.id },
        data: {
          payoutAmount,
          resolvedAt: now,
          settlementPrice: settlementPriceRaw.toFixed(8),
          status: result,
        },
      });

      settledCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${bet.id}: ${msg}`);
      console.error(`[/api/predict/settle] Error settling bet ${bet.id}:`, error);
    }
  }

  console.log(
    `[/api/predict/settle] Settled ${settledCount} bets (${wonCount} WON, ${lostCount} LOST). Errors: ${errors.length}.`,
  );

  return NextResponse.json({
    errors,
    lostCount,
    settled: settledCount,
    wonCount,
  });
}
