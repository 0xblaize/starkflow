import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPredictEscrowConfigured } from "@/lib/predict-escrow-config";
import {
  buildPredictMarketView,
  formatCompactUsd,
  predictMarketDefinitions,
} from "@/lib/predict-markets";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { withTimeout } from "@/lib/promise-timeout";

function formatRelativeTime(value: Date) {
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function toNumeric(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );
    const priceSnapshots = await withTimeout(
      getLatestPredictPrices(
        predictMarketDefinitions.map((market) => market.baseAsset),
      ),
      6_000,
      "Prediction price feed timed out.",
    );

    let allBets: Array<{
      createdAt: Date;
      marketId: string;
      marketTitle: string;
      outcome: string;
      stakeAmount: string;
      user: {
        handlePublic: boolean;
        username: string | null;
      };
    }> = [];
    let myBets: Array<{
      createdAt: Date;
      currentPrice: string | null;
      entryProbabilityBps: number | null;
      executionMode: string;
      id: string;
      marketCategory: string;
      marketId: string;
      marketTitle: string;
      onchainMarketId: string | null;
      outcome: string;
      stakeAmount: string;
      stakeCurrency: string;
      status: string;
      targetPrice: string;
      txHash: string | null;
    }> = [];

    try {
      [allBets, myBets] = await withTimeout(
        Promise.all([
          prisma.predictionBet.findMany({
            take: 24,
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              marketId: true,
              marketTitle: true,
              outcome: true,
              stakeAmount: true,
              user: {
                select: {
                  handlePublic: true,
                  username: true,
                },
              },
            },
          }),
          prisma.predictionBet.findMany({
            where: { userId: user.id },
            take: 12,
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              currentPrice: true,
              entryProbabilityBps: true,
              executionMode: true,
              id: true,
              marketCategory: true,
              marketId: true,
              marketTitle: true,
              onchainMarketId: true,
              outcome: true,
              stakeAmount: true,
              stakeCurrency: true,
              status: true,
              targetPrice: true,
              txHash: true,
            },
          }),
        ]),
        6_000,
        "Prediction history timed out.",
      );
    } catch (error) {
      console.warn("[/api/predict/markets] DB stats unavailable:", error);
    }

    const marketStats = new Map<
      string,
      {
        totalBets: number;
        totalVolumeUsd: number;
      }
    >();

    for (const bet of allBets) {
      const previous = marketStats.get(bet.marketId) ?? {
        totalBets: 0,
        totalVolumeUsd: 0,
      };

      previous.totalBets += 1;
      previous.totalVolumeUsd += toNumeric(bet.stakeAmount);
      marketStats.set(bet.marketId, previous);
    }

    const markets = predictMarketDefinitions.map((market) =>
      buildPredictMarketView(
        market,
        priceSnapshots[market.baseAsset],
        marketStats.get(market.id),
      ),
    );

    const totalVolumeUsd = [...marketStats.values()].reduce(
      (sum, market) => sum + market.totalVolumeUsd,
      0,
    );

    const feed = allBets.slice(0, 6).map((bet) => {
      const publicHandle =
        bet.user.handlePublic && bet.user.username?.trim()
          ? `@${bet.user.username}.stark`
          : "Anonymous trader";

      return {
        body: `${publicHandle} sized ${bet.stakeAmount} USDC on ${bet.outcome}.`,
        time: formatRelativeTime(bet.createdAt),
        title: bet.marketTitle,
      };
    });

    return NextResponse.json({
      feed,
      markets,
      myBets: myBets.map((bet) => ({
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
      network: user.preferredNetwork,
      onchainExecutionLive:
        user.preferredNetwork === "sepolia" && isPredictEscrowConfigured(),
      summary: {
        activeHedges: myBets.filter((bet) => bet.status === "OPEN").length,
        activeHedgesDisplay: String(
          myBets.filter((bet) => bet.status === "OPEN").length,
        ).padStart(2, "0"),
        priceSources: Array.from(
          new Set(
            markets
              .map((market) => market.priceSource)
              .filter((source) => source !== "Unavailable"),
          ),
        ),
        totalVolumeDisplay: formatCompactUsd(totalVolumeUsd),
        totalVolumeUsd,
      },
    });
  } catch (error) {
    console.error("[/api/predict/markets]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load prediction markets.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
