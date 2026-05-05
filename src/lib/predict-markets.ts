export type PredictAsset = "BTC" | "ETH" | "STRK";
export type PredictOutcome = "YES" | "NO";
export type PredictOperator = "above" | "below";

export type PredictMarketDefinition = {
  baseAsset: PredictAsset;
  category: string;
  description: string;
  id: string;
  onchainMarketId: string;
  operator: PredictOperator;
  timeframe: string;
};

export type PredictPriceSnapshot = {
  asset: PredictAsset;
  priceUsd: number | null;
  source: "CoinGecko" | "Pragma" | "Unavailable";
  updatedAt: string | null;
};

/**
 * Market definitions no longer hold static prices — targets are computed
 * dynamically each cycle using the live spot price and historical σ.
 */
export const predictMarketDefinitions: PredictMarketDefinition[] = [
  {
    id: "eth-above-1sigma-24h",
    onchainMarketId: "ETH24HUP",
    baseAsset: "ETH",
    category: "Crypto Hedge",
    description:
      "Track a tight ETH upside move over the next 24 hours. Target resets each cycle to spot + 1σ volatility.",
    operator: "above",
    timeframe: "Next 24h",
  },
  {
    id: "strk-below-1sigma-24h",
    onchainMarketId: "STRK24HDN",
    baseAsset: "STRK",
    category: "Starknet Ecosystem",
    description:
      "Keep the STRK market close to spot so the move can actually happen inside a day. Target resets to spot − 1σ.",
    operator: "below",
    timeframe: "Next 24h",
  },
  {
    id: "btc-above-1sigma-24h",
    onchainMarketId: "BTC24HUP",
    baseAsset: "BTC",
    category: "Macro Hedge",
    description:
      "Use a live BTC price step that is realistic inside 24 hours. Target resets to spot + 1σ volatility.",
    operator: "above",
    timeframe: "Next 24h",
  },
] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatUsd(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMarketPrice(value: number) {
  return formatUsd(value, value < 10 ? 4 : value < 100 ? 2 : 0);
}

// ---------------------------------------------------------------------------
// σ-based target computation
// ---------------------------------------------------------------------------

/**
 * Compute the strike price for the 24h market using live spot + 1σ.
 *
 * above market:  target = spot × (1 + σ)
 * below market:  target = spot × (1 − σ)
 *
 * If spot is unavailable we still return a best-effort value using the
 * sigma alone, which the caller can display as "pending oracle".
 */
export function computeTargetPriceUsd(
  operator: PredictOperator,
  spotPriceUsd: number,
  sigmaFraction: number,
): number {
  if (operator === "above") {
    return spotPriceUsd * (1 + sigmaFraction);
  }

  return Math.max(0, spotPriceUsd * (1 - sigmaFraction));
}

// ---------------------------------------------------------------------------
// Probability model (logistic curve around the strike)
// ---------------------------------------------------------------------------

export function computePredictProbabilities(
  operator: PredictOperator,
  currentPriceUsd: number | null,
  targetPriceUsd: number,
) {
  if (currentPriceUsd == null || !Number.isFinite(currentPriceUsd)) {
    return {
      noProbability: 50,
      state: "Oracle pending",
      yesProbability: 50,
    };
  }

  const ratioDelta = (currentPriceUsd - targetPriceUsd) / targetPriceUsd;
  const signedDelta = operator === "above" ? ratioDelta : ratioDelta * -1;
  const logistic = 1 / (1 + Math.exp(-signedDelta * 14));
  const yesProbability = clamp(Math.round(logistic * 100), 5, 95);
  const noProbability = 100 - yesProbability;

  let state = "Near target";

  if (signedDelta > 0.06) {
    state = "Leaning YES";
  } else if (signedDelta < -0.06) {
    state = "Leaning NO";
  }

  return { noProbability, state, yesProbability };
}

// ---------------------------------------------------------------------------
// Market view builder
// ---------------------------------------------------------------------------

export function getPredictMarketDefinition(marketId: string) {
  return (
    predictMarketDefinitions.find((market) => market.id === marketId) ?? null
  );
}

/**
 * Build the full market view from a definition + live oracle snapshot + σ.
 *
 * `sigmaFraction` (e.g. 0.023) is supplied by the caller so this function
 * remains pure and testable without network access.
 */
export function buildPredictMarketView(
  market: PredictMarketDefinition,
  snapshot: PredictPriceSnapshot | null,
  sigmaFraction: number,
  stats?: {
    totalBets?: number;
    totalVolumeUsd?: number;
  },
) {
  const currentPriceUsd = snapshot?.priceUsd ?? null;

  // When spot is unavailable use 0 as a stand-in; probabilities default to 50/50.
  const effectiveSpot = currentPriceUsd ?? 0;

  const targetPriceUsd = effectiveSpot > 0
    ? computeTargetPriceUsd(market.operator, effectiveSpot, sigmaFraction)
    : 0;

  const plusTargetUsd = effectiveSpot > 0
    ? effectiveSpot * (1 + sigmaFraction)
    : 0;

  const minusTargetUsd = effectiveSpot > 0
    ? Math.max(0, effectiveSpot * (1 - sigmaFraction))
    : 0;

  const probabilities = computePredictProbabilities(
    market.operator,
    currentPriceUsd,
    targetPriceUsd,
  );

  const targetPriceDisplay =
    targetPriceUsd > 0 ? formatMarketPrice(targetPriceUsd) : "Pending oracle";

  const currentPriceDisplay =
    currentPriceUsd != null
      ? formatMarketPrice(currentPriceUsd)
      : "Unavailable";

  const sigmaPercent = `${(sigmaFraction * 100).toFixed(2)}%`;

  // Title: "ETH > $1,950.23 in 24h"
  const comparator = market.operator === "above" ? ">" : "<";
  const title =
    targetPriceUsd > 0
      ? `${market.baseAsset} ${comparator} ${formatMarketPrice(targetPriceUsd)} in 24h`
      : `${market.baseAsset} ${comparator} ??? in 24h`;

  return {
    ...market,
    currentPriceDisplay,
    currentPriceUsd,
    minusTargetDisplay: minusTargetUsd > 0 ? formatMarketPrice(minusTargetUsd) : "—",
    minusTargetUsd,
    noProbability: probabilities.noProbability,
    plusTargetDisplay: plusTargetUsd > 0 ? formatMarketPrice(plusTargetUsd) : "—",
    plusTargetUsd,
    priceSource: snapshot?.source ?? "Unavailable",
    sigmaFraction,
    sigmaPercent,
    sourceUpdatedAt: snapshot?.updatedAt ?? null,
    state: probabilities.state,
    targetPriceDisplay,
    targetPriceUsd,
    title,
    totalBets: stats?.totalBets ?? 0,
    totalVolumeDisplay: formatCompactUsd(stats?.totalVolumeUsd ?? 0),
    totalVolumeUsd: stats?.totalVolumeUsd ?? 0,
    yesProbability: probabilities.yesProbability,
  };
}
