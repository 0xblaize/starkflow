type StarknetRpcNetwork = "mainnet" | "sepolia";

const DEFAULT_RPC_URLS: Record<StarknetRpcNetwork, string> = {
  sepolia: "https://starknet-sepolia-rpc.publicnode.com/",
  mainnet: "https://starknet-rpc.publicnode.com/",
};

function pickRpcUrl(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmed = candidate.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export function getStarknetRpcUrl(network: StarknetRpcNetwork) {
  if (network === "mainnet") {
    return (
      pickRpcUrl(
        process.env.STARKNET_MAINNET_RPC_URL,
        process.env.NEXT_PUBLIC_STARKNET_MAINNET_RPC_URL,
      ) ?? DEFAULT_RPC_URLS.mainnet
    );
  }

  return (
    pickRpcUrl(
      process.env.STARKNET_RPC_URL,
      process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
    ) ?? DEFAULT_RPC_URLS.sepolia
  );
}
