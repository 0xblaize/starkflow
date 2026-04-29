import { StarkZap } from "starkzap";

type Network = "sepolia" | "mainnet";

const sepoliaRpc =
  process.env.STARKNET_RPC_URL ||
  "https://starknet-sepolia.public.blastapi.io";

const mainnetRpc =
  process.env.STARKNET_MAINNET_RPC_URL ||
  "https://starknet-mainnet.public.blastapi.io";

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
const sdkCache: Partial<Record<Network, StarkZap>> = {};

/**
 * Returns a StarkZap SDK instance for the given network.
 * Cached after first creation.
 */
export function getSdk(network: Network = "sepolia"): StarkZap {
  if (!sdkCache[network]) {
    sdkCache[network] = new StarkZap({
      network,
      rpcUrl: network === "mainnet" ? mainnetRpc : sepoliaRpc,
      ...buildPaymaster(network),
    });
  }
  return sdkCache[network]!;
}

export const paymasterEnabled = Boolean(avnuApiKey);
