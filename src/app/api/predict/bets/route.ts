import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPredictMarketView,
  formatUsd,
  getPredictMarketDefinition,
  type PredictOutcome,
} from "@/lib/predict-markets";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import { getAssetVolatility } from "@/lib/predict-volatility";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";

type CreatePredictionBetBody = {
  currentProbabilityBps?: number;
  escrowAddress?: string;
  executionMode?: "OFFCHAIN" | "ONCHAIN";
  marketId?: string;
  onchainMarketId?: string;
  outcome?: PredictOutcome;
  stakeAmount?: string;
  txHash?: string;
};

function normalizeStakeAmount(raw: string | undefined) {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid USDC stake amount.");
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const bets = await prisma.predictionBet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      bets: bets.map((bet) => ({
        createdAt: bet.createdAt.toISOString(),
        currentPrice: bet.currentPrice,
        entryProbabilityBps: bet.entryProbabilityBps,
        executionMode: bet.executionMode,
        id: bet.id,
        marketCategory: bet.marketCategory,
        marketId: bet.marketId,
        marketTitle: bet.marketTitle,
        onchainMarketId: bet.onchainMarketId,
        outcome: bet.outcome,
        stakeAmount: bet.stakeAmount,
        stakeCurrency: bet.stakeCurrency,
        status: bet.status,
        targetPrice: bet.targetPrice,
        txHash: bet.txHash,
      })),
    });
  } catch (error) {
    console.error("[/api/predict/bets][GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load prediction bets.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as CreatePredictionBetBody;
    const marketId = body.marketId?.trim() ?? "";
    const outcome = body.outcome === "NO" ? "NO" : body.outcome === "YES" ? "YES" : null;
    const executionMode = body.executionMode === "ONCHAIN" ? "ONCHAIN" : "OFFCHAIN";
    const txHash = body.txHash?.trim() ?? null;
    const onchainMarketId = body.onchainMarketId?.trim() ?? null;
    const escrowAddress = body.escrowAddress?.trim() ?? null;
    const currentProbabilityBps =
      body.currentProbabilityBps != null && Number.isInteger(body.currentProbabilityBps)
        ? body.currentProbabilityBps
        : null;

    if (!marketId || !outcome) {
      return NextResponse.json(
        { error: "Choose a market and a valid outcome." },
        { status: 400 },
      );
    }

    if (executionMode === "ONCHAIN" && (!txHash || !onchainMarketId || !escrowAddress)) {
      return NextResponse.json(
        { error: "Onchain prediction records require a tx hash, market id, and escrow address." },
        { status: 400 },
      );
    }

    const stakeAmount = normalizeStakeAmount(body.stakeAmount);
    const market = getPredictMarketDefinition(marketId);

    if (!market) {
      return NextResponse.json(
        { error: "Unknown prediction market." },
        { status: 404 },
      );
    }

    const prices = await getLatestPredictPrices([market.baseAsset]);
    const snapshot = prices[market.baseAsset] ?? null;
    const currentPrice = snapshot?.priceUsd ?? null;

    if (currentPrice == null) {
      return NextResponse.json(
        { error: "The live price feed is unavailable for this market right now." },
        { status: 503 },
      );
    }

    // Fetch current σ so we can store it with the bet and use it for settlement.
    const volatilitySnap = await getAssetVolatility(market.baseAsset).catch(() => null);
    const sigmaFraction = volatilitySnap?.sigmaFraction ?? 0.025;
    const volatilityBps = Math.round(sigmaFraction * 10_000);

    const marketView = buildPredictMarketView(market, snapshot, sigmaFraction);

    // 24h cycle: the settlement window closes exactly 24 hours after placement.
    const cycleExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);

    const bet = await prisma.predictionBet.create({
      data: {
        baseAsset: market.baseAsset,
        currentPrice: currentPrice.toFixed(8),
        cycleExpiresAt,
        entryProbabilityBps: currentProbabilityBps,
        escrowAddress,
        executionMode,
        marketCategory: market.category,
        marketId: market.id,
        marketTitle: marketView.title,
        network: user.preferredNetwork,
        onchainMarketId,
        outcome,
        quoteAsset: "USD",
        stakeAmount: stakeAmount.toFixed(2),
        stakeCurrency: "USDC",
        status: "OPEN",
        targetPrice: marketView.targetPriceUsd.toFixed(8),
        txHash,
        userId: user.id,
        volatilityBps,
      },
    });

    return NextResponse.json({
      bet: {
        createdAt: bet.createdAt.toISOString(),
        currentPrice: formatUsd(currentPrice, currentPrice < 10 ? 4 : 2),
        entryProbabilityBps: bet.entryProbabilityBps,
        executionMode: bet.executionMode,
        id: bet.id,
        marketCategory: bet.marketCategory,
        marketId: bet.marketId,
        marketTitle: bet.marketTitle,
        onchainMarketId: bet.onchainMarketId,
        outcome: bet.outcome,
        stakeAmount: bet.stakeAmount,
        stakeCurrency: bet.stakeCurrency,
        status: bet.status,
        targetPrice: formatUsd(
          Number(bet.targetPrice),
          Number(bet.targetPrice) < 10 ? 3 : 2,
        ),
        txHash: bet.txHash,
      },
      message:
        executionMode === "ONCHAIN"
          ? `${bet.outcome} submitted onchain with ${bet.stakeAmount} ${bet.stakeCurrency}.`
          : `${bet.outcome} saved with a ${bet.stakeAmount} ${bet.stakeCurrency} hedge.`,
      priceSource: prices[market.baseAsset]?.source ?? "Unavailable",
    });
  } catch (error) {
    console.error("[/api/predict/bets][POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save prediction bet.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
