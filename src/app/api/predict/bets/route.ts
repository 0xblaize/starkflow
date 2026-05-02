import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatUsd,
  getPredictMarketDefinition,
  type PredictOutcome,
} from "@/lib/predict-markets";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";

type CreatePredictionBetBody = {
  marketId?: string;
  outcome?: PredictOutcome;
  stakeAmount?: string;
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
        id: bet.id,
        marketCategory: bet.marketCategory,
        marketId: bet.marketId,
        marketTitle: bet.marketTitle,
        outcome: bet.outcome,
        stakeAmount: bet.stakeAmount,
        stakeCurrency: bet.stakeCurrency,
        status: bet.status,
        targetPrice: bet.targetPrice,
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

    if (!marketId || !outcome) {
      return NextResponse.json(
        { error: "Choose a market and a valid outcome." },
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
    const currentPrice = prices[market.baseAsset]?.priceUsd ?? null;

    if (currentPrice == null) {
      return NextResponse.json(
        { error: "The live price feed is unavailable for this market right now." },
        { status: 503 },
      );
    }

    const bet = await prisma.predictionBet.create({
      data: {
        baseAsset: market.baseAsset,
        currentPrice: currentPrice.toFixed(8),
        marketCategory: market.category,
        marketId: market.id,
        marketTitle: market.title,
        network: user.preferredNetwork,
        outcome,
        quoteAsset: "USD",
        stakeAmount: stakeAmount.toFixed(2),
        stakeCurrency: "USDC",
        status: "OPEN",
        targetPrice: market.targetPriceUsd.toFixed(8),
        userId: user.id,
      },
    });

    return NextResponse.json({
      bet: {
        createdAt: bet.createdAt.toISOString(),
        currentPrice: formatUsd(currentPrice, currentPrice < 10 ? 4 : 2),
        id: bet.id,
        marketCategory: bet.marketCategory,
        marketId: bet.marketId,
        marketTitle: bet.marketTitle,
        outcome: bet.outcome,
        stakeAmount: bet.stakeAmount,
        stakeCurrency: bet.stakeCurrency,
        status: bet.status,
        targetPrice: formatUsd(
          Number(bet.targetPrice),
          Number(bet.targetPrice) < 10 ? 3 : 2,
        ),
      },
      message: `${bet.outcome} saved with a ${bet.stakeAmount} ${bet.stakeCurrency} hedge.`,
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
