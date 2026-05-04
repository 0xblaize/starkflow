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
  referencePriceUsd: number;
  targetOffsetUsd: number;
  timeframe: string;
};

export type PredictPriceSnapshot = {
  asset: PredictAsset;
  priceUsd: number | null;
  source: "CoinGecko" | "Pragma" | "Unavailable";
  updatedAt: string | null;
};

export const predictMarketDefinitions: PredictMarketDefinition[] = [
  {
    id: "eth-above-3200-friday",
    onchainMarketId: "ETH24HUP",
    baseAsset: "ETH",
    category: "Crypto Hedge",
    description:
      "Track a tight ETH upside move over the next 24 hours instead of a far-away moon target.",
    operator: "above",
    referencePriceUsd: 2350,
    targetOffsetUsd: 50,
    timeframe: "Next 24h",
  },
  {
    id: "strk-below-0_85-eod",
    onchainMarketId: "STRK24HDN",
    baseAsset: "STRK",
    category: "Starknet Ecosystem",
    description:
      "Keep the STRK market close to spot so the move can actually happen inside a day.",
    operator: "below",
    referencePriceUsd: 0.75,
    targetOffsetUsd: 0.05,
    timeframe: "Next 24h",
  },
  {
    id: "btc-above-100k-week",
    onchainMarketId: "BTC24HUP",
    baseAsset: "BTC",
    category: "Macro Hedge",
    description:
      "Use a small BTC price step that is realistic inside 24 hours instead of a distant six-figure target.",
    operator: "above",
    referencePriceUsd: 76000,
    targetOffsetUsd: 100,
    timeframe: "Next 24h",
  },
] as const;

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

function formatOffsetDisplay(value: number) {
  if (value >= 1) {
    return formatUsd(value, value < 10 ? 2 : 0);
  }

  return formatUsd(value, 4);
}

function computeTargetPriceUsd(
  market: PredictMarketDefinition,
  _currentPriceUsd: number | null,
) {
  const basePrice = market.referencePriceUsd;

  return market.operator === "above"
    ? basePrice + market.targetOffsetUsd
    : Math.max(0, basePrice - market.targetOffsetUsd);
}

function buildMarketTitle(
  market: PredictMarketDefinition,
  targetPriceUsd: number,
) {
  const comparator = market.operator === "above" ? ">" : "<";
  return `${market.baseAsset} ${comparator} ${formatMarketPrice(targetPriceUsd)} in 24h`;
}

export function getPredictMarketDefinition(marketId: string) {
  return (
    predictMarketDefinitions.find((market) => market.id === marketId) ?? null
  );
}

export function computePredictProbabilities(
  market: PredictMarketDefinition,
  currentPriceUsd: number | null,
) {
  const targetPriceUsd = computeTargetPriceUsd(market, currentPriceUsd);

  if (currentPriceUsd == null || !Number.isFinite(currentPriceUsd)) {
    return {
      noProbability: 50,
      state: "Oracle pending",
      targetPriceUsd,
      yesProbability: 50,
    };
  }

  const ratioDelta =
    (currentPriceUsd - targetPriceUsd) / targetPriceUsd;
  const signedDelta =
    market.operator === "above" ? ratioDelta : ratioDelta * -1;
  const logistic = 1 / (1 + Math.exp(-signedDelta * 14));
  const yesProbability = clamp(Math.round(logistic * 100), 5, 95);
  const noProbability = 100 - yesProbability;

  let state = "Near target";

  if (signedDelta > 0.06) {
    state = "Leaning YES";
  } else if (signedDelta < -0.06) {
    state = "Leaning NO";
  }

  return {
    noProbability,
    state,
    targetPriceUsd,
    yesProbability,
  };
}

export function buildPredictMarketView(
  market: PredictMarketDefinition,
  snapshot: PredictPriceSnapshot | null,
  stats?: {
    totalBets?: number;
    totalVolumeUsd?: number;
  },
) {
  const currentPriceUsd = snapshot?.priceUsd ?? null;
  const probabilities = computePredictProbabilities(market, currentPriceUsd);
  const targetPriceDisplay = formatMarketPrice(probabilities.targetPriceUsd);
  const currentPriceDisplay =
    currentPriceUsd != null
      ? formatMarketPrice(currentPriceUsd)
      : "Unavailable";

  return {
    ...market,
    currentPriceDisplay,
    currentPriceUsd,
    noProbability: probabilities.noProbability,
    priceSource: snapshot?.source ?? "Unavailable",
    sourceUpdatedAt: snapshot?.updatedAt ?? null,
    state: probabilities.state,
    targetOffsetDisplay: formatOffsetDisplay(market.targetOffsetUsd),
    targetPriceDisplay,
    targetPriceUsd: probabilities.targetPriceUsd,
    title: buildMarketTitle(market, probabilities.targetPriceUsd),
    totalBets: stats?.totalBets ?? 0,
    totalVolumeDisplay: formatCompactUsd(stats?.totalVolumeUsd ?? 0),
    totalVolumeUsd: stats?.totalVolumeUsd ?? 0,
    yesProbability: probabilities.yesProbability,
  };
}
