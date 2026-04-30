import { RpcProvider } from "starknet";
import { mainnetTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.js";
import type { Address } from "../../node_modules/starkzap/dist/src/types/address.js";
import { sepoliaTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.sepolia.js";
import type { Token } from "../../node_modules/starkzap/dist/src/types/token.js";
import { normalizePreferredNetwork, type PreferredNetwork } from "@/lib/app-user";
import { normalizeStarknetAddress } from "@/lib/move-recipient";

type TokenPreset = {
  address: string;
  decimals: number;
  metadata?: {
    logoUrl?: URL;
  };
  name: string;
  symbol: string;
};

export type MoveToken = Token & {
  key: string;
  logoUrl: string | null;
};

const providerCache: Partial<Record<PreferredNetwork, RpcProvider>> = {};

const NETWORK_CONFIG: Record<PreferredNetwork, { rpcUrl: string }> = {
  sepolia: {
    rpcUrl:
      process.env.STARKNET_RPC_URL ??
      "https://starknet-sepolia-rpc.publicnode.com/",
  },
  mainnet: {
    rpcUrl:
      process.env.STARKNET_MAINNET_RPC_URL ??
      "https://starknet-mainnet-rpc.publicnode.com/",
  },
};

const FEATURED_SYMBOLS = [
  "STRK",
  "USDC",
  "USDC.e",
  "ETH",
  "USDT",
  "WBTC",
  "wstETH",
  "EKUBO",
] as const;

function getProvider(network: PreferredNetwork) {
  if (!providerCache[network]) {
    providerCache[network] = new RpcProvider({
      nodeUrl: NETWORK_CONFIG[network].rpcUrl,
    });
  }

  return providerCache[network]!;
}

function getPresetMap(network: PreferredNetwork) {
  return network === "mainnet" ? mainnetTokens : sepoliaTokens;
}

function sortTokens(tokens: MoveToken[], query: string) {
  if (query) {
    const lowered = query.toLowerCase();

    return tokens.sort((left, right) => {
      const leftExact =
        left.symbol.toLowerCase() === lowered || left.name.toLowerCase() === lowered;
      const rightExact =
        right.symbol.toLowerCase() === lowered || right.name.toLowerCase() === lowered;

      if (leftExact !== rightExact) return leftExact ? -1 : 1;

      const leftStarts =
        left.symbol.toLowerCase().startsWith(lowered) ||
        left.name.toLowerCase().startsWith(lowered);
      const rightStarts =
        right.symbol.toLowerCase().startsWith(lowered) ||
        right.name.toLowerCase().startsWith(lowered);

      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;

      return left.symbol.localeCompare(right.symbol);
    });
  }

  return tokens.sort((left, right) => {
    const leftFeatured = FEATURED_SYMBOLS.includes(left.symbol as (typeof FEATURED_SYMBOLS)[number]);
    const rightFeatured = FEATURED_SYMBOLS.includes(
      right.symbol as (typeof FEATURED_SYMBOLS)[number],
    );

    if (leftFeatured !== rightFeatured) return leftFeatured ? -1 : 1;

    const leftHasLogo = Boolean(left.logoUrl);
    const rightHasLogo = Boolean(right.logoUrl);

    if (leftHasLogo !== rightHasLogo) return leftHasLogo ? -1 : 1;

    return left.symbol.localeCompare(right.symbol);
  });
}

export function getVerifiedMoveTokens(preferredNetwork?: string | null) {
  const network = normalizePreferredNetwork(preferredNetwork);
  const presets = getPresetMap(network) as Record<string, TokenPreset>;

  return Object.entries(presets).map(([key, token]) => ({
    key,
    symbol: token.symbol,
    name: token.name,
    address: normalizeStarknetAddress(token.address) as Address,
    decimals: token.decimals,
    metadata: token.metadata,
    logoUrl: token.metadata?.logoUrl?.toString() ?? null,
  }));
}

export function searchVerifiedMoveTokens(
  preferredNetwork: string | null | undefined,
  query: string,
  limit = 24,
) {
  const lowered = query.trim().toLowerCase();
  const tokens = getVerifiedMoveTokens(preferredNetwork).filter((token) => {
    if (!lowered) return true;

    return (
      token.symbol.toLowerCase().includes(lowered) ||
      token.name.toLowerCase().includes(lowered) ||
      token.address.toLowerCase() === lowered ||
      token.key.toLowerCase().includes(lowered)
    );
  });

  return sortTokens(tokens, lowered).slice(0, limit);
}

export function findMoveTokenByAddress(
  preferredNetwork: string | null | undefined,
  tokenAddress: string,
) {
  const normalized = normalizeStarknetAddress(tokenAddress);

  return getVerifiedMoveTokens(preferredNetwork).find(
    (token) => normalizeStarknetAddress(token.address) === normalized,
  );
}

function parseUint256(response: string[]) {
  const low = BigInt(response[0] ?? "0");
  const high = BigInt(response[1] ?? "0");
  return low + high * BigInt(2) ** BigInt(128);
}

function formatTokenAmount(value: bigint, decimals: number, fractionDigits: number) {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const scaledFraction =
    fractionDigits === 0
      ? BigInt(0)
      : (fraction * BigInt(10) ** BigInt(fractionDigits)) / divisor;

  return `${whole.toString()}.${scaledFraction
    .toString()
    .padStart(fractionDigits, "0")}`;
}

export async function readMoveTokenBalance(
  preferredNetwork: string | null | undefined,
  accountAddress: string,
  token: MoveToken,
) {
  const network = normalizePreferredNetwork(preferredNetwork);
  const provider = getProvider(network);

  try {
    const response = await provider.callContract({
      contractAddress: token.address,
      entrypoint: "balanceOf",
      calldata: [normalizeStarknetAddress(accountAddress)],
    });
    const value = parseUint256(response);
    const fractionDigits = token.decimals >= 18 ? 4 : 2;

    return {
      balanceDisplay: `${formatTokenAmount(value, token.decimals, fractionDigits)} ${token.symbol}`,
      balanceRaw: value.toString(),
    };
  } catch (error) {
    console.error(`[move-tokens] failed to read ${token.symbol} balance`, error);
    return {
      balanceDisplay: null,
      balanceRaw: null,
    };
  }
}
