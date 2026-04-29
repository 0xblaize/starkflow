import { RpcProvider } from "starknet";
import { mainnetTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.js";
import { sepoliaTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.sepolia.js";
import { normalizePreferredNetwork, type PreferredNetwork } from "@/lib/app-user";

type Network = "mainnet" | "sepolia";

type TokenPreset = {
  address: string;
  decimals: number;
  symbol: string;
};

const NETWORK_CONFIG: Record<Network, { rpcUrl: string }> = {
  sepolia: {
    rpcUrl:
      process.env.STARKNET_RPC_URL ??
      "https://starknet-sepolia.g.alchemy.com/v2/docs-demo",
  },
  mainnet: {
    rpcUrl:
      process.env.STARKNET_MAINNET_RPC_URL ??
      "https://starknet-mainnet.g.alchemy.com/v2/docs-demo",
  },
};

const providerCache: Partial<Record<Network, RpcProvider>> = {};

function getProvider(network: Network) {
  if (!providerCache[network]) {
    providerCache[network] = new RpcProvider({
      nodeUrl: NETWORK_CONFIG[network].rpcUrl,
    });
  }

  return providerCache[network]!;
}

function getTokens(network: Network): { STRK: TokenPreset; USDC: TokenPreset } {
  const presets = network === "mainnet" ? mainnetTokens : sepoliaTokens;
  return {
    STRK: presets.STRK,
    USDC: presets.USDC,
  };
}

async function readTokenBalance(
  provider: RpcProvider,
  accountAddress: string,
  token: TokenPreset,
  fractionDigits: number,
  fallback: string,
) {
  try {
    const response = await provider.callContract({
      contractAddress: token.address,
      entrypoint: "balanceOf",
      calldata: [accountAddress],
    });

    return formatTokenBalance(
      parseUint256(response),
      token.decimals,
      token.symbol,
      fractionDigits,
    );
  } catch (error) {
    console.error(`[starknet-read] failed to read ${token.symbol} balance`, error);
    return fallback;
  }
}

function parseUint256(response: string[]) {
  const low = BigInt(response[0] ?? "0");
  const high = BigInt(response[1] ?? "0");
  return low + high * BigInt(2) ** BigInt(128);
}

function formatTokenBalance(
  value: bigint,
  decimals: number,
  symbol: string,
  fractionDigits: number,
) {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  const scaledFraction =
    fractionDigits === 0
      ? BigInt(0)
      : (fraction * BigInt(10) ** BigInt(fractionDigits)) / divisor;

  return `${whole.toString()}.${scaledFraction
    .toString()
    .padStart(fractionDigits, "0")} ${symbol}`;
}

export async function getWalletDeploymentState(
  address: string,
  preferredNetwork?: string | null,
) {
  const network = normalizePreferredNetwork(preferredNetwork) as PreferredNetwork;
  const provider = getProvider(network);

  try {
    await provider.getClassHashAt(address);
    return {
      deployed: true,
      network,
    };
  } catch {
    return {
      deployed: false,
      network,
    };
  }
}

export async function getReadOnlyWalletBalances(
  address: string,
  preferredNetwork?: string | null,
) {
  const network = normalizePreferredNetwork(preferredNetwork) as PreferredNetwork;
  const provider = getProvider(network);
  const tokens = getTokens(network);

  const [strk, usdc] = await Promise.all([
    readTokenBalance(provider, address, tokens.STRK, 4, "0.0000 STRK"),
    readTokenBalance(provider, address, tokens.USDC, 2, "0.00 USDC"),
  ]);

  return {
    address,
    network,
    strk,
    usdc,
    strkbtc: "0.0000 strkBTC",
  };
}
