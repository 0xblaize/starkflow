/**
 * POST /api/predict/settle
 *
 * Settlement engine for 24h prediction markets.
 * Intended to be called by an external scheduler such as GitHub Actions.
 *
 * For each OPEN bet whose cycleExpiresAt has passed:
 * - OFFCHAIN bets are settled in Prisma only.
 * - ONCHAIN bets resolve the escrow market, read the winning side onchain,
 *   and attempt payout via `claim_for(user)` using the resolver account.
 *
 * Auth: Bearer token must match process.env.CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordAppTransaction } from "@/lib/app-transactions";
import {
  claimPredictEscrowWinningsFor,
  getPredictEscrowMarketState,
  isPredictEscrowAutomationConfigured,
  normalizePredictEscrowError,
  resolvePredictEscrowMarket,
  type PredictEscrowNetwork,
} from "@/lib/predict-escrow-admin";
import { prisma } from "@/lib/prisma";
import { getPredictMarketDefinition } from "@/lib/predict-markets";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import type { PredictAsset } from "@/lib/predict-markets";

type ExpiredBet = {
  baseAsset: string;
  entryProbabilityBps: number | null;
  escrowAddress: string | null;
  executionMode: string;
  id: string;
  marketId: string;
  network: string;
  onchainMarketId: string | null;
  outcome: string;
  stakeAmount: string;
  targetPrice: string;
  user: {
    starknetAddress: string | null;
  };
  userId: string;
};

type OnchainGroup = {
  bets: ExpiredBet[];
  escrowAddress: string;
  key: string;
  marketId: string;
  network: PredictEscrowNetwork;
  onchainMarketId: string;
};

const SIDE_YES = 1;
const SIDE_NO = 2;

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return token === cronSecret;
}

function parseNumericSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOutcome(
  operator: "above" | "below",
  userOutcome: string,
  settlementPrice: number,
  targetPrice: number,
): "WON" | "LOST" {
  const priceHitTarget =
    operator === "above"
      ? settlementPrice >= targetPrice
      : settlementPrice <= targetPrice;
  const userWon = userOutcome === "YES" ? priceHitTarget : !priceHitTarget;
  return userWon ? "WON" : "LOST";
}

function computeInformationalPayout(
  stakeAmount: string,
  entryProbabilityBps: number | null | undefined,
) {
  const stakeValue = parseNumericSafe(stakeAmount) ?? 0;
  const entryProbFraction =
    entryProbabilityBps != null && entryProbabilityBps > 0
      ? entryProbabilityBps / 10_000
      : 0.5;
  const payout = stakeValue / Math.max(entryProbFraction, 0.01);
  return payout.toFixed(2);
}

function toPredictNetwork(value: string): PredictEscrowNetwork {
  return value === "mainnet" ? "mainnet" : "sepolia";
}

function buildOnchainGroupKey(bet: ExpiredBet) {
  return [
    toPredictNetwork(bet.network),
    bet.escrowAddress?.trim() ?? "",
    bet.onchainMarketId?.trim() ?? "",
  ].join("|");
}

function rawPriceToUsd(raw: bigint) {
  return Number(raw) / 100_000_000;
}

function computeOnchainPayout(stakeAmount: string, yesPoolRaw: bigint, noPoolRaw: bigint, winningSide: number) {
  const stakeValue = parseNumericSafe(stakeAmount) ?? 0;
  const totalPoolRaw = yesPoolRaw + noPoolRaw;
  const winningPoolRaw = winningSide === SIDE_YES ? yesPoolRaw : noPoolRaw;

  if (stakeValue <= 0 || winningPoolRaw === BigInt(0)) {
    return "0.00";
  }

  const multiplier = Number(totalPoolRaw) / Number(winningPoolRaw);

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return "0.00";
  }

  return (stakeValue * multiplier).toFixed(2);
}

async function settleOffchainBet(
  bet: ExpiredBet,
  settlementPriceRaw: number | null,
  now: Date,
) {
  const market = getPredictMarketDefinition(bet.marketId);

  if (!market) {
    throw new Error(`unknown market ${bet.marketId}`);
  }

  if (settlementPriceRaw == null) {
    throw new Error(`no oracle price for ${bet.baseAsset}`);
  }

  const targetPrice = parseNumericSafe(bet.targetPrice);

  if (targetPrice == null || targetPrice <= 0) {
    throw new Error(`invalid stored targetPrice ${bet.targetPrice}`);
  }

  const result = resolveOutcome(
    market.operator,
    bet.outcome,
    settlementPriceRaw,
    targetPrice,
  );
  const payoutAmount =
    result === "WON"
      ? computeInformationalPayout(bet.stakeAmount, bet.entryProbabilityBps)
      : "0.00";

  await prisma.predictionBet.update({
    where: { id: bet.id },
    data: {
      payoutAmount,
      resolvedAt: now,
      settlementPrice: settlementPriceRaw.toFixed(8),
      status: result,
    },
  });

  return result;
}

async function settleOnchainGroup(
  group: OnchainGroup,
  settlementPriceRaw: number | null,
  now: Date,
  errors: string[],
) {
  if (settlementPriceRaw == null) {
    errors.push(`${group.marketId}: no oracle price for ${group.bets[0]?.baseAsset ?? "asset"}`);
    return { claimed: 0, lost: 0, settled: 0, won: 0 };
  }

  if (!isPredictEscrowAutomationConfigured()) {
    errors.push(
      `${group.marketId}: onchain settlement skipped because resolver credentials are not configured.`,
    );
    return { claimed: 0, lost: 0, settled: 0, won: 0 };
  }

  try {
    await resolvePredictEscrowMarket({
      escrowAddress: group.escrowAddress,
      finalPriceUsd: settlementPriceRaw,
      network: group.network,
      onchainMarketId: group.onchainMarketId,
    });
  } catch (error) {
    const normalized = normalizePredictEscrowError(error);

    if (normalized !== "MARKET_DONE") {
      errors.push(`${group.marketId}: resolve failed - ${normalized}`);
      return { claimed: 0, lost: 0, settled: 0, won: 0 };
    }
  }

  const marketState = await getPredictEscrowMarketState({
    escrowAddress: group.escrowAddress,
    network: group.network,
    onchainMarketId: group.onchainMarketId,
  });

  if (!marketState.resolved || (marketState.winningSide !== SIDE_YES && marketState.winningSide !== SIDE_NO)) {
    errors.push(`${group.marketId}: market did not resolve to a valid side.`);
    return { claimed: 0, lost: 0, settled: 0, won: 0 };
  }

  const settlementPriceDisplay = rawPriceToUsd(marketState.settlementPriceRaw || BigInt(Math.round(settlementPriceRaw * 100_000_000))).toFixed(8);
  const winningOutcome = marketState.winningSide === SIDE_YES ? "YES" : "NO";
  const settledRows: Array<{
    bet: ExpiredBet;
    payoutAmount: string;
    result: "WON" | "LOST";
  }> = group.bets.map((bet) => ({
    bet,
    payoutAmount:
      bet.outcome === winningOutcome
        ? computeOnchainPayout(
            bet.stakeAmount,
            marketState.yesPoolRaw,
            marketState.noPoolRaw,
            marketState.winningSide,
          )
        : "0.00",
    result: bet.outcome === winningOutcome ? "WON" : "LOST",
  }));

  let settled = 0;
  let won = 0;
  let lost = 0;
  let claimed = 0;

  for (const row of settledRows.filter((item) => item.result === "LOST")) {
    await prisma.predictionBet.update({
      where: { id: row.bet.id },
      data: {
        payoutAmount: row.payoutAmount,
        resolvedAt: now,
        settlementPrice: settlementPriceDisplay,
        status: "LOST",
      },
    });
    settled += 1;
    lost += 1;
  }

  const winnerGroups = new Map<
    string,
    {
      bets: Array<{
        bet: ExpiredBet;
        payoutAmount: string;
      }>;
      userAddress: string;
    }
  >();

  for (const row of settledRows.filter((item) => item.result === "WON")) {
    const userAddress = row.bet.user.starknetAddress?.trim();

    if (!userAddress) {
      await prisma.predictionBet.update({
        where: { id: row.bet.id },
        data: {
          payoutAmount: row.payoutAmount,
          resolvedAt: now,
          settlementPrice: settlementPriceDisplay,
          status: "WON",
        },
      });
      settled += 1;
      won += 1;
      errors.push(`${row.bet.id}: winning bet has no Starknet address to receive payout.`);
      continue;
    }

    const key = `${group.onchainMarketId}|${userAddress.toLowerCase()}`;
    const current = winnerGroups.get(key) ?? {
      bets: [],
      userAddress,
    };
    current.bets.push({ bet: row.bet, payoutAmount: row.payoutAmount });
    winnerGroups.set(key, current);
  }

  for (const winnerGroup of winnerGroups.values()) {
    let claimTxHash: string | null = null;
    let claimedAt: Date | null = null;

    try {
      claimTxHash = await claimPredictEscrowWinningsFor({
        escrowAddress: group.escrowAddress,
        network: group.network,
        onchainMarketId: group.onchainMarketId,
        userAddress: winnerGroup.userAddress,
      });
      claimedAt = now;
      claimed += 1;

      await recordAppTransaction({
        kind: "predict_claim",
        network: group.network,
        sponsoredExecution: false,
        txHash: claimTxHash,
        userId: winnerGroup.bets[0].bet.userId,
        walletAddress: winnerGroup.userAddress,
      });
    } catch (error) {
      const normalized = normalizePredictEscrowError(error);

      if (normalized === "ALREADY_CLAIMED") {
        claimedAt = now;
      } else {
        errors.push(
          `${group.marketId}:${winnerGroup.userAddress} claim failed - ${normalized}`,
        );
      }
    }

    for (const row of winnerGroup.bets) {
      await prisma.predictionBet.update({
        where: { id: row.bet.id },
        data: {
          claimTxHash,
          claimedAt,
          payoutAmount: row.payoutAmount,
          resolvedAt: now,
          settlementPrice: settlementPriceDisplay,
          status: "WON",
        },
      });
      settled += 1;
      won += 1;
    }
  }

  return { claimed, lost, settled, won };
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
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
      baseAsset: true,
      entryProbabilityBps: true,
      escrowAddress: true,
      executionMode: true,
      id: true,
      marketId: true,
      network: true,
      onchainMarketId: true,
      outcome: true,
      stakeAmount: true,
      targetPrice: true,
      user: {
        select: {
          starknetAddress: true,
        },
      },
      userId: true,
    },
    take: 100,
  });

  if (expiredBets.length === 0) {
    return NextResponse.json({ settled: 0, message: "No expired bets to settle." });
  }

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

  const errors: string[] = [];
  let settledCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let claimCount = 0;

  const offchainBets = expiredBets.filter((bet) => bet.executionMode !== "ONCHAIN");
  const onchainBets = expiredBets.filter((bet) => bet.executionMode === "ONCHAIN");

  for (const bet of offchainBets) {
    try {
      const result = await settleOffchainBet(
        bet,
        priceSnapshots[bet.baseAsset as PredictAsset]?.priceUsd ?? null,
        now,
      );
      settledCount += 1;
      if (result === "WON") {
        wonCount += 1;
      } else {
        lostCount += 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${bet.id}: ${msg}`);
      console.error(`[/api/predict/settle] Error settling offchain bet ${bet.id}:`, error);
    }
  }

  const onchainGroups = new Map<string, OnchainGroup>();

  for (const bet of onchainBets) {
    const escrowAddress = bet.escrowAddress?.trim();
    const onchainMarketId = bet.onchainMarketId?.trim();

    if (!escrowAddress || !onchainMarketId) {
      errors.push(`${bet.id}: missing onchain escrow metadata.`);
      continue;
    }

    const key = buildOnchainGroupKey(bet);
    const existing = onchainGroups.get(key);

    if (existing) {
      existing.bets.push(bet);
      continue;
    }

    onchainGroups.set(key, {
      bets: [bet],
      escrowAddress,
      key,
      marketId: bet.marketId,
      network: toPredictNetwork(bet.network),
      onchainMarketId,
    });
  }

  for (const group of onchainGroups.values()) {
    try {
      const summary = await settleOnchainGroup(
        group,
        priceSnapshots[group.bets[0].baseAsset as PredictAsset]?.priceUsd ?? null,
        now,
        errors,
      );
      claimCount += summary.claimed;
      lostCount += summary.lost;
      settledCount += summary.settled;
      wonCount += summary.won;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${group.marketId}: ${msg}`);
      console.error(`[/api/predict/settle] Error settling onchain market ${group.key}:`, error);
    }
  }

  console.log(
    `[/api/predict/settle] Settled ${settledCount} bets (${wonCount} WON, ${lostCount} LOST, ${claimCount} claims). Errors: ${errors.length}.`,
  );

  return NextResponse.json({
    claimsSubmitted: claimCount,
    errors,
    lostCount,
    settled: settledCount,
    wonCount,
  });
}
