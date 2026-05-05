import type { PredictAsset } from "@/lib/predict-markets";

const COINGECKO_IDS: Record<PredictAsset, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  STRK: "starknet",
};

/**
 * Minimum and maximum σ fractions we'll ever return.
 * - Floor at 0.5% so the band is never zero-width.
 * - Cap at 15% so we don't produce absurd targets on micro-cap spikes.
 */
const SIGMA_FLOOR = 0.005;
const SIGMA_CAP = 0.15;

type VolatilitySnapshot = {
  asset: PredictAsset;
  sigmaFraction: number; // e.g. 0.023 = 2.3%
  sigmaBps: number;      // e.g. 230
  source: "CoinGecko" | "Fallback";
  computedAt: number;    // Date.now() when computed
};

/**
 * Per-asset cache: expires after 1 hour.
 */
const volatilityCache = new Map<PredictAsset, VolatilitySnapshot>();
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

/**
 * Fallback σ per asset when the historical feed is unavailable.
 * Based on typical 30-day realised volatility ranges.
 */
const FALLBACK_SIGMA: Record<PredictAsset, number> = {
  BTC: 0.025, // ~2.5% daily σ
  ETH: 0.030, // ~3.0%
  STRK: 0.055, // ~5.5% (higher-beta alt)
};

type CoinGeckoOhlcvRow = [
  number, // timestamp ms
  number, // open
  number, // high
  number, // low
  number, // close
];

/**
 * Compute population standard deviation of an array of numbers.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Fetch 30-day OHLCV from CoinGecko and return the 1σ daily log-return fraction.
 */
async function fetchVolatilityFromCoinGecko(
  asset: PredictAsset,
): Promise<number> {
  const id = COINGECKO_IDS[asset];

  // CoinGecko free-tier: /coins/{id}/ohlc?vs_currency=usd&days=30
  // Returns array of [timestamp, open, high, low, close] – daily candles.
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=30`;
  const response = await fetch(url, { next: { revalidate: 3_600 } });

  if (!response.ok) {
    throw new Error(`CoinGecko OHLCV returned ${response.status} for ${asset}.`);
  }

  const rows = (await response.json()) as CoinGeckoOhlcvRow[];

  if (!Array.isArray(rows) || rows.length < 3) {
    throw new Error(`CoinGecko returned insufficient OHLCV data for ${asset}.`);
  }

  // Use closing prices to compute log returns.
  const closes = rows.map((row) => row[4]);
  const logReturns: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];

    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length < 2) {
    throw new Error(`Not enough data points to compute σ for ${asset}.`);
  }

  const sigma = stddev(logReturns);
  // Clamp to sane range.
  return Math.min(Math.max(sigma, SIGMA_FLOOR), SIGMA_CAP);
}

/**
 * Return a cached or freshly-computed volatility snapshot for the given asset.
 * Falls back to FALLBACK_SIGMA if the API call fails.
 */
export async function getAssetVolatility(
  asset: PredictAsset,
): Promise<VolatilitySnapshot> {
  const cached = volatilityCache.get(asset);

  if (cached && Date.now() - cached.computedAt < CACHE_TTL_MS) {
    return cached;
  }

  let sigmaFraction: number;
  let source: "CoinGecko" | "Fallback";

  try {
    sigmaFraction = await fetchVolatilityFromCoinGecko(asset);
    source = "CoinGecko";
  } catch (error) {
    console.warn(
      `[predict-volatility] Falling back to static σ for ${asset}:`,
      error,
    );
    sigmaFraction = FALLBACK_SIGMA[asset];
    source = "Fallback";
  }

  const snapshot: VolatilitySnapshot = {
    asset,
    sigmaFraction,
    sigmaBps: Math.round(sigmaFraction * 10_000),
    source,
    computedAt: Date.now(),
  };

  volatilityCache.set(asset, snapshot);
  return snapshot;
}

/**
 * Batch-fetch volatility for multiple assets concurrently.
 * Returns a map keyed by asset.
 */
export async function getAssetsVolatility(
  assets: PredictAsset[],
): Promise<Record<PredictAsset, VolatilitySnapshot>> {
  const unique = [...new Set(assets)];

  const result: Record<PredictAsset, VolatilitySnapshot> = {
    BTC: { asset: "BTC", sigmaFraction: FALLBACK_SIGMA.BTC, sigmaBps: Math.round(FALLBACK_SIGMA.BTC * 10_000), source: "Fallback", computedAt: 0 },
    ETH: { asset: "ETH", sigmaFraction: FALLBACK_SIGMA.ETH, sigmaBps: Math.round(FALLBACK_SIGMA.ETH * 10_000), source: "Fallback", computedAt: 0 },
    STRK: { asset: "STRK", sigmaFraction: FALLBACK_SIGMA.STRK, sigmaBps: Math.round(FALLBACK_SIGMA.STRK * 10_000), source: "Fallback", computedAt: 0 },
  };

  await Promise.all(
    unique.map(async (asset) => {
      try {
        result[asset] = await getAssetVolatility(asset);
      } catch {
        // keep fallback already set above
      }
    }),
  );

  return result;
}
