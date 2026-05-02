import type { PredictAsset, PredictPriceSnapshot } from "@/lib/predict-markets";

const PRAGMA_BASE_URL =
  process.env.PRAGMA_API_BASE_URL ??
  "https://api.production.pragma.build/node/v1";

const coingeckoAssetIds: Record<PredictAsset, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  STRK: "starknet",
};

const priceCache = new Map<
  string,
  {
    expiresAt: number;
    value: Record<PredictAsset, PredictPriceSnapshot>;
  }
>();

function cacheKeyForAssets(assets: PredictAsset[]) {
  return [...new Set(assets)].sort().join(",");
}

function normalizePragmaFixedPoint(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed / 1e18;
}

async function fetchPragmaAssetPrice(
  asset: PredictAsset,
): Promise<PredictPriceSnapshot | null> {
  const apiKey = process.env.PRAGMA_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `${PRAGMA_BASE_URL}/aggregation/candlestick/${asset}/USD?interval=1min&aggregation=median&entry_type=spot`,
    {
      headers: {
        "x-api-key": apiKey,
      },
      next: { revalidate: 30 },
    },
  );

  if (!response.ok) {
    throw new Error(`Pragma returned ${response.status} for ${asset}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      close?: string | number;
      end_timestamp?: number;
    }>;
  };
  const latest = payload.data?.[0];
  const normalizedPrice = normalizePragmaFixedPoint(latest?.close);

  if (normalizedPrice == null) {
    throw new Error(`Pragma returned an unreadable price for ${asset}.`);
  }

  return {
    asset,
    priceUsd: normalizedPrice,
    source: "Pragma",
    updatedAt:
      typeof latest?.end_timestamp === "number"
        ? new Date(latest.end_timestamp).toISOString()
        : new Date().toISOString(),
  };
}

async function fetchCoinGeckoPrices(assets: PredictAsset[]) {
  const ids = [...new Set(assets.map((asset) => coingeckoAssetIds[asset]))];

  if (ids.length === 0) {
    return new Map<string, number>();
  }

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
    {
      next: { revalidate: 30 },
    },
  );

  if (!response.ok) {
    throw new Error(`CoinGecko returned ${response.status}.`);
  }

  const payload = (await response.json()) as Record<
    string,
    { usd?: number | null }
  >;
  const prices = new Map<string, number>();

  for (const [id, value] of Object.entries(payload)) {
    if (typeof value?.usd === "number") {
      prices.set(id, value.usd);
    }
  }

  return prices;
}

export async function getLatestPredictPrices(assets: PredictAsset[]) {
  const key = cacheKeyForAssets(assets);
  const cached = priceCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const uniqueAssets = [...new Set(assets)];
  const snapshots: Record<PredictAsset, PredictPriceSnapshot> = {
    BTC: {
      asset: "BTC",
      priceUsd: null,
      source: "Unavailable",
      updatedAt: null,
    },
    ETH: {
      asset: "ETH",
      priceUsd: null,
      source: "Unavailable",
      updatedAt: null,
    },
    STRK: {
      asset: "STRK",
      priceUsd: null,
      source: "Unavailable",
      updatedAt: null,
    },
  };

  const missingAssets: PredictAsset[] = [];

  await Promise.all(
    uniqueAssets.map(async (asset) => {
      try {
        const snapshot = await fetchPragmaAssetPrice(asset);

        if (snapshot) {
          snapshots[asset] = snapshot;
          return;
        }
      } catch {
        // Fallback below.
      }

      missingAssets.push(asset);
    }),
  );

  if (missingAssets.length > 0) {
    try {
      const fallbackPrices = await fetchCoinGeckoPrices(missingAssets);

      for (const asset of missingAssets) {
        const usd = fallbackPrices.get(coingeckoAssetIds[asset]) ?? null;

        snapshots[asset] = {
          asset,
          priceUsd: usd,
          source: usd != null ? "CoinGecko" : "Unavailable",
          updatedAt: usd != null ? new Date().toISOString() : null,
        };
      }
    } catch {
      for (const asset of missingAssets) {
        snapshots[asset] = {
          asset,
          priceUsd: null,
          source: "Unavailable",
          updatedAt: null,
        };
      }
    }
  }

  priceCache.set(key, {
    expiresAt: Date.now() + 30_000,
    value: snapshots,
  });

  return snapshots;
}
