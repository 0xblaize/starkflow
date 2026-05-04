import { hash, RpcProvider } from "starknet";
import { mainnetTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.js";
import { sepoliaTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.sepolia.js";
import { normalizePreferredNetwork, type PreferredNetwork } from "@/lib/app-user";
import { getStarknetRpcUrl } from "@/lib/starknet-rpc";

type Network = "mainnet" | "sepolia";

type TokenPreset = {
  address: string;
  decimals: number;
  symbol: string;
};

type ActivityItem = {
  amount: string;
  blockNumber: number;
  contractAddress: string;
  direction: "received" | "sent";
  fromAddress: string;
  id: string;
  symbol: "STRK" | "USDC";
  toAddress: string;
  txHash: string;
};

const providerCache = new Map<string, RpcProvider>();
let strkPriceCache: { fetchedAt: number; priceUsd: number | null } | null = null;
let btcPriceCache: { fetchedAt: number; priceUsd: number | null } | null = null;

function getProvider(network: Network) {
  const rpcUrl = getStarknetRpcUrl(network);
  const cacheKey = `${network}:${rpcUrl}`;
  const cached = providerCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const provider = new RpcProvider({
    nodeUrl: rpcUrl,
  });
  providerCache.set(cacheKey, provider);
  return provider;
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
  const value = await readTokenBalanceValue(provider, accountAddress, token);

  if (value === null) {
    return fallback;
  }

  return formatTokenBalance(
    value,
    token.decimals,
    token.symbol,
    fractionDigits,
  );
}

async function readTokenBalanceValue(
  provider: RpcProvider,
  accountAddress: string,
  token: TokenPreset,
) {
  try {
    const response = await provider.callContract({
      contractAddress: token.address,
      entrypoint: "balanceOf",
      calldata: [accountAddress],
    });

    return parseUint256(response);
  } catch (error) {
    console.error(`[starknet-read] failed to read ${token.symbol} balance`, error);
    return null;
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

function normalizeAddress(value: string) {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value.toLowerCase();
  }
}

async function getFilteredTransferEvents(
  provider: RpcProvider,
  tokenAddress: string,
  fromBlock: number,
  keys: string[][],
) {
  const events = [];
  let continuationToken: string | undefined;

  for (let page = 0; page < 8; page += 1) {
    const response = await provider.getEvents({
      address: tokenAddress,
      from_block: { block_number: fromBlock },
      to_block: "latest",
      chunk_size: 100,
      continuation_token: continuationToken,
      keys,
    });

    events.push(...response.events);

    if (!response.continuation_token) {
      break;
    }

    continuationToken = response.continuation_token;
  }

  return events;
}

async function getStrkUsdPrice() {
  if (strkPriceCache && Date.now() - strkPriceCache.fetchedAt < 60_000) {
    return strkPriceCache.priceUsd;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd",
      {
        headers: {
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      starknet?: { usd?: number };
    };
    const priceUsd =
      typeof payload?.starknet?.usd === "number" ? payload.starknet.usd : null;

    strkPriceCache = {
      fetchedAt: Date.now(),
      priceUsd,
    };

    return priceUsd;
  } catch (error) {
    console.error("[starknet-read] failed to fetch STRK/USD price", error);
    strkPriceCache = {
      fetchedAt: Date.now(),
      priceUsd: null,
    };
    return null;
  }
}

async function getBitcoinUsdPrice() {
  if (btcPriceCache && Date.now() - btcPriceCache.fetchedAt < 60_000) {
    return btcPriceCache.priceUsd;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      {
        headers: {
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      bitcoin?: { usd?: number };
    };
    const priceUsd =
      typeof payload?.bitcoin?.usd === "number" ? payload.bitcoin.usd : null;

    btcPriceCache = {
      fetchedAt: Date.now(),
      priceUsd,
    };

    return priceUsd;
  } catch (error) {
    console.error("[starknet-read] failed to fetch BTC/USD price", error);
    btcPriceCache = {
      fetchedAt: Date.now(),
      priceUsd: null,
    };
    return null;
  }
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

  const [strkValue, usdcValue, strkPriceUsd, btcPriceUsd] = await Promise.all([
    readTokenBalanceValue(provider, address, tokens.STRK),
    readTokenBalanceValue(provider, address, tokens.USDC),
    getStrkUsdPrice(),
    getBitcoinUsdPrice(),
  ]);

  const strkAmount = strkValue
    ? formatTokenAmount(strkValue, tokens.STRK.decimals, 4)
    : "0.0000";
  const usdcAmount = usdcValue
    ? formatTokenAmount(usdcValue, tokens.USDC.decimals, 2)
    : "0.00";

  const strk = `${strkAmount} STRK`;
  const usdc = `${usdcAmount} USDC`;
  const usdTotal =
    Number(usdcAmount) + (strkPriceUsd ? Number(strkAmount) * strkPriceUsd : 0);
  const portfolioStrkbtc =
    typeof btcPriceUsd === "number" && btcPriceUsd > 0
      ? (usdTotal / btcPriceUsd).toFixed(6)
      : "0.000000";

  return {
    address,
    network,
    strk,
    usdc,
    strkbtc: "0.0000 strkBTC",
    portfolioStrkbtc,
    usdTotal: usdTotal.toFixed(2),
    strkPriceUsd:
      typeof strkPriceUsd === "number" ? strkPriceUsd.toFixed(4) : null,
    btcPriceUsd:
      typeof btcPriceUsd === "number" ? btcPriceUsd.toFixed(2) : null,
    tokenAddresses: {
      strk: tokens.STRK.address,
      usdc: tokens.USDC.address,
    },
  };
}

export async function getRecentWalletActivity(
  address: string,
  preferredNetwork?: string | null,
) {
  const network = normalizePreferredNetwork(preferredNetwork) as PreferredNetwork;
  const provider = getProvider(network);
  const tokens = getTokens(network);
  const normalizedAddress = normalizeAddress(address);
  const transferSelector = hash.getSelectorFromName("Transfer");
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 20_000);

  const tokenEntries = [
    { symbol: "STRK", token: tokens.STRK },
    { symbol: "USDC", token: tokens.USDC },
  ] as const;

  const eventGroups = await Promise.all(
    tokenEntries.map(async ({ symbol, token }) => {
      try {
        const [receivedEvents, sentEvents] = await Promise.all([
          getFilteredTransferEvents(provider, token.address, fromBlock, [
            [transferSelector],
            [],
            [normalizedAddress],
          ]),
          getFilteredTransferEvents(provider, token.address, fromBlock, [
            [transferSelector],
            [normalizedAddress],
          ]),
        ]);

        return [...receivedEvents, ...sentEvents]
            .map((event) => {
              const from = normalizeAddress(event.keys[1] ?? "0x0");
              const to = normalizeAddress(event.keys[2] ?? "0x0");

            if (from !== normalizedAddress && to !== normalizedAddress) {
              return null;
            }

            const amount = parseUint256(event.data);
            const direction = to === normalizedAddress ? "received" : "sent";

              return {
                id: `${event.transaction_hash}:${symbol}:${direction}:${event.block_number ?? 0}`,
                symbol,
                direction,
                amount: formatTokenAmount(amount, token.decimals, symbol === "USDC" ? 2 : 4),
                fromAddress: from,
                toAddress: to,
                txHash: event.transaction_hash,
                blockNumber: event.block_number ?? 0,
                contractAddress: token.address,
            };
          })
          .filter((event): event is ActivityItem => event !== null);
      } catch (error) {
        console.error(`[starknet-read] failed to read ${symbol} events`, error);
        return [];
      }
    }),
  );

  return eventGroups
    .flat()
    .filter(
      (event, index, items) =>
        items.findIndex((candidate) => candidate.id === event.id) === index,
    )
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 50);
}
