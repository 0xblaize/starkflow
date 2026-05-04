import { StarkZap } from "starkzap";
import { getStarknetRpcUrl } from "@/lib/starknet-rpc";

type Network = "sepolia" | "mainnet";

const avnuApiKey = process.env.AVNU_PAYMASTER_API_KEY;

/** Network-specific AVNU Paymaster URLs */
const PAYMASTER_URLS: Record<Network, string> = {
  sepolia: "https://sepolia.paymaster.avnu.fi",
  mainnet: "https://starknet.paymaster.avnu.fi",
};

function buildPaymaster(network: Network) {
  if (!avnuApiKey) return {};
  return {
    paymaster: {
      nodeUrl: PAYMASTER_URLS[network],
      headers: { "x-paymaster-api-key": avnuApiKey },
    },
  };
}

/** Cache one SDK instance per network to avoid re-init overhead. */
const sdkCache = new Map<string, StarkZap>();

/**
 * Returns a StarkZap SDK instance for the given network.
 * Cached after first creation.
 */
export function getSdk(network: Network = "sepolia"): StarkZap {
  const rpcUrl = getStarknetRpcUrl(network);
  const cacheKey = `${network}:${rpcUrl}`;
  const cached = sdkCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const sdk = new StarkZap({
    network,
    rpcUrl,
    ...buildPaymaster(network),
  });

  sdkCache.set(cacheKey, sdk);
  return sdk;
}

export const paymasterEnabled = Boolean(avnuApiKey);
