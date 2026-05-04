import { NextRequest, NextResponse } from "next/server";
import { getPrivyErrorStatus, getPrivyWalletJwts, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { prisma } from "@/lib/prisma";
import { buildPredictionPositionView } from "@/lib/predict-positions";
import { getLatestPredictPrices } from "@/lib/predict-prices";
import { withTimeout } from "@/lib/promise-timeout";
import { initStarkFlow } from "@/lib/starkflow-init";
import type { PredictAsset, PredictPriceSnapshot } from "@/lib/predict-markets";
import { Amount } from "../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type { LendingUserPosition } from "../../../../../node_modules/starkzap/dist/src/lending/interface.js";

function parseNumeric(value: string | null | undefined, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${formatter.format(Math.abs(value))}`;
}

function formatUnsignedUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRawAmount(rawValue: bigint, decimals: number, symbol: string) {
  return Amount.fromRaw(rawValue, decimals, symbol)
    .toFormatted(true)
    .replace(/\s+/g, " ");
}

function formatRawUsd(rawValue: bigint) {
  return Amount.fromRaw(rawValue, 18, "USD")
    .toFormatted(true)
    .replace(/\s+/g, " ");
}

function mapYieldPosition(position: LendingUserPosition) {
  return {
    canWithdraw: position.type === "earn",
    collateralAmount: formatRawAmount(
      position.collateral.amount,
      position.collateral.token.decimals,
      position.collateral.token.symbol,
    ),
    collateralTokenAddress: position.collateral.token.address,
    collateralTokenDecimals: position.collateral.token.decimals,
    collateralSymbol: position.collateral.token.symbol,
    collateralUsdValue:
      position.collateral.usdValue != null
        ? formatRawUsd(position.collateral.usdValue)
        : null,
    debtAmount:
      position.debt != null
        ? formatRawAmount(
            position.debt.amount,
            position.debt.token.decimals,
            position.debt.token.symbol,
          )
        : null,
    debtSymbol: position.debt?.token.symbol ?? null,
    debtUsdValue:
      position.debt?.usdValue != null ? formatRawUsd(position.debt.usdValue) : null,
    pool: position.pool.name ?? position.pool.id,
    poolId: position.pool.id,
    type: position.type,
  };
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );
    const [predictionBets, dcaStrategies] = await Promise.all([
      withTimeout(
        prisma.predictionBet.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        6_000,
        "Prediction history timed out.",
      ),
      withTimeout(
        prisma.dcaStrategy.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        6_000,
        "DCA history timed out.",
      ),
    ]);

    const assets = Array.from(
      new Set(predictionBets.map((bet) => bet.baseAsset as PredictAsset)),
    );
    const priceSnapshots: Partial<Record<PredictAsset, PredictPriceSnapshot>> =
      assets.length > 0
        ? await withTimeout(
            getLatestPredictPrices(assets),
            6_000,
            "Prediction prices timed out.",
          )
        : {};

    const predictionPositions = predictionBets
      .map((bet) =>
        buildPredictionPositionView(
          bet,
          priceSnapshots[bet.baseAsset as PredictAsset] ?? null,
        ),
      )
      .filter((position) => position != null);

    let yieldPositions: Array<ReturnType<typeof mapYieldPosition>> = [];
    let yieldError: string | null = null;

    if (user.starknetAddress) {
      try {
        const userJwts = getPrivyWalletJwts(req);
        const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });
        const positions: LendingUserPosition[] = await withTimeout(
          flow.wallet
            .lending()
            .getPositions()
            .catch(() => [] as LendingUserPosition[]),
          5_000,
          "Yield positions timed out.",
        );

        yieldPositions = positions.map(mapYieldPosition);
      } catch (error) {
        console.warn("[/api/me/portfolio] yield positions unavailable:", error);
        yieldError =
          error instanceof Error ? error.message : "Yield positions are unavailable right now.";
      }
    }

    const openPredictions = predictionPositions.filter(
      (position) => position.status === "OPEN",
    );
    const totalPredictionStake = openPredictions.reduce(
      (sum, position) => sum + parseNumeric(position.stakeAmount),
      0,
    );
    const totalPredictionUnrealizedPnl = openPredictions.reduce(
      (sum, position) => sum + position.unrealizedPnlValue,
      0,
    );

    return NextResponse.json({
      dcaStrategies: dcaStrategies.map((strategy) => ({
        buyTokenSymbol: strategy.buyTokenSymbol,
        createdAt: strategy.createdAt.toISOString(),
        frequency: strategy.frequency,
        id: strategy.id,
        orderAddress: strategy.orderAddress,
        providerId: strategy.providerId,
        sellAmount: strategy.sellAmount,
        sellPerCycle: strategy.sellPerCycle,
        sellTokenSymbol: strategy.sellTokenSymbol,
        status: strategy.status,
        strategyId: strategy.strategyId,
        txHash: strategy.txHash,
      })),
      predictionPositions,
      summary: {
        activeDcaCount: dcaStrategies.filter((strategy) => strategy.status === "ACTIVE").length,
        openPredictionCount: openPredictions.length,
        totalPredictionStake: formatUnsignedUsd(totalPredictionStake),
        totalPredictionUnrealizedPnl: formatUsd(totalPredictionUnrealizedPnl),
        yieldPositionCount: yieldPositions.length,
      },
      yieldError,
      yieldPositions,
    });
  } catch (error) {
    console.error("[/api/me/portfolio]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load managed positions.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
