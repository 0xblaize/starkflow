import {
  buildPredictMarketView,
  formatUsd,
  getPredictMarketDefinition,
  type PredictOutcome,
  type PredictPriceSnapshot,
} from "@/lib/predict-markets";

type PredictionBetRecord = {
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
  volatilityBps: number | null;
};

export type PredictionPositionView = {
  createdAt: string;
  currentMarkValue: string;
  currentPriceDisplay: string;
  currentProbability: number;
  direction: "flat" | "gaining" | "losing";
  entryProbability: number;
  executionMode: string;
  id: string;
  marketCategory: string;
  marketId: string;
  marketTitle: string;
  onchainMarketId: string | null;
  outcome: PredictOutcome;
  potentialPayout: string;
  potentialProfit: string;
  stakeAmount: string;
  stakeCurrency: string;
  status: string;
  targetPriceDisplay: string;
  txHash: string | null;
  unrealizedPnl: string;
  unrealizedPnlValue: number;
};

function parseNumeric(value: string | null | undefined, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSignedUsd(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatUsd(Math.abs(value), 2)}`;
}

function normalizeOutcome(value: string): PredictOutcome {
  return value === "NO" ? "NO" : "YES";
}

export function buildPredictionPositionView(
  bet: PredictionBetRecord,
  latestSnapshot: PredictPriceSnapshot | null,
): PredictionPositionView | null {
  const market = getPredictMarketDefinition(bet.marketId);

  if (!market) {
    return null;
  }

  const outcome = normalizeOutcome(bet.outcome);
  const stakeValue = parseNumeric(bet.stakeAmount);
  const entryPriceUsd = parseNumeric(bet.currentPrice, 0);

  // σ stored at bet time (in bps). Fall back to 2.5% if not recorded.
  const entryBetSigma =
    bet.volatilityBps != null && bet.volatilityBps > 0
      ? bet.volatilityBps / 10_000
      : 0.025;

  // Reconstruct the entry target from the stored entry price + sigma.
  // entryView.targetPriceDisplay will show this correctly in the UI.

  const entrySnapshot: PredictPriceSnapshot = {
    asset: market.baseAsset,
    priceUsd: entryPriceUsd || null,
    source: "Unavailable",
    updatedAt: bet.createdAt.toISOString(),
  };

  const entryView = buildPredictMarketView(
    market,
    entrySnapshot,
    entryBetSigma,
  );
  const currentView = buildPredictMarketView(
    market,
    latestSnapshot,
    entryBetSigma, // use the same entry σ so the title target stays consistent
  );

  const storedEntryProbability =
    bet.entryProbabilityBps != null
      ? Math.max(bet.entryProbabilityBps / 10_000, 0.01)
      : null;
  const entryProbability =
    storedEntryProbability ??
    (outcome === "YES" ? entryView.yesProbability / 100 : entryView.noProbability / 100);
  const currentProbability =
    outcome === "YES"
      ? currentView.yesProbability / 100
      : currentView.noProbability / 100;

  const effectiveEntryProbability = Math.max(entryProbability, 0.01);
  const impliedUnits = stakeValue / effectiveEntryProbability;
  const currentMarkValue = impliedUnits * currentProbability;
  const unrealizedPnlValue = currentMarkValue - stakeValue;
  const potentialPayoutValue = impliedUnits;
  const potentialProfitValue = potentialPayoutValue - stakeValue;

  const direction: "flat" | "gaining" | "losing" =
    unrealizedPnlValue > 0.01 ? "gaining" : unrealizedPnlValue < -0.01 ? "losing" : "flat";

  return {
    createdAt: bet.createdAt.toISOString(),
    currentMarkValue: formatUsd(currentMarkValue, 2),
    currentPriceDisplay: currentView.currentPriceDisplay,
    currentProbability: outcome === "YES" ? currentView.yesProbability : currentView.noProbability,
    direction,
    entryProbability:
      bet.entryProbabilityBps != null
        ? Math.round(bet.entryProbabilityBps / 100)
        : outcome === "YES"
          ? entryView.yesProbability
          : entryView.noProbability,
    executionMode: bet.executionMode,
    id: bet.id,
    marketCategory: bet.marketCategory,
    marketId: bet.marketId,
    marketTitle: bet.marketTitle,
    onchainMarketId: bet.onchainMarketId,
    outcome,
    potentialPayout: formatUsd(potentialPayoutValue, 2),
    potentialProfit: formatSignedUsd(potentialProfitValue),
    stakeAmount: bet.stakeAmount,
    stakeCurrency: bet.stakeCurrency,
    status: bet.status,
    targetPriceDisplay: currentView.targetPriceDisplay,
    txHash: bet.txHash,
    unrealizedPnl: formatSignedUsd(unrealizedPnlValue),
    unrealizedPnlValue,
  };
}
