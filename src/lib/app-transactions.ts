import { RpcProvider } from "starknet";
import { prisma } from "@/lib/prisma";
import { runPrismaWithRecovery } from "@/lib/prisma";
import { getStarknetRpcUrl } from "@/lib/starknet-rpc";

type StarknetNetwork = "mainnet" | "sepolia";

export const APP_TRANSACTION_KINDS = [
  "dca_cancel",
  "dca_create",
  "predict_claim",
  "predict_place",
  "send",
  "swap",
  "yield_deposit",
  "yield_withdraw",
] as const;

export type AppTransactionKind =
  | "dca_cancel"
  | "dca_create"
  | "predict_claim"
  | "predict_place"
  | "send"
  | "swap"
  | "yield_deposit"
  | "yield_withdraw";

type RecordAppTransactionInput = {
  explorerUrl?: string | null;
  kind: AppTransactionKind;
  network: StarknetNetwork;
  sponsoredExecution?: boolean;
  txHash: string;
  userId: string;
  walletAddress: string;
};

type FeeSnapshot = {
  raw: string;
  token: "ETH" | "STRK" | "UNKNOWN";
  unit: string | null;
  usd: string | null;
};

const providerCache = new Map<string, RpcProvider>();
const priceCache = new Map<string, { fetchedAt: number; priceUsd: number | null }>();

function normalizeHex(value: string) {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function getProvider(network: StarknetNetwork) {
  const rpcUrl = getStarknetRpcUrl(network);
  const cacheKey = `${network}:${rpcUrl}`;
  const cached = providerCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  providerCache.set(cacheKey, provider);
  return provider;
}

function getFeeTokenFromUnit(unit: string | null) {
  const normalized = unit?.toUpperCase() ?? "";

  if (normalized === "FRI" || normalized === "STRK") {
    return "STRK" as const;
  }

  if (normalized === "WEI" || normalized === "ETH") {
    return "ETH" as const;
  }

  return "UNKNOWN" as const;
}

function parseActualFee(receipt: unknown): { raw: bigint; unit: string | null } | null {
  if (!receipt || typeof receipt !== "object") {
    return null;
  }

  const candidate = receipt as {
    actualFee?: unknown;
    actual_fee?: unknown;
  };
  const feeValue = candidate.actualFee ?? candidate.actual_fee;

  if (feeValue == null) {
    return null;
  }

  if (typeof feeValue === "bigint") {
    return { raw: feeValue, unit: null };
  }

  if (typeof feeValue === "number" || typeof feeValue === "string") {
    try {
      return { raw: BigInt(feeValue), unit: null };
    } catch {
      return null;
    }
  }

  if (typeof feeValue === "object") {
    const feeObject = feeValue as {
      amount?: bigint | number | string;
      unit?: string;
    };

    if (feeObject.amount == null) {
      return null;
    }

    try {
      return {
        raw: BigInt(feeObject.amount),
        unit: feeObject.unit ?? null,
      };
    } catch {
      return null;
    }
  }

  return null;
}

function rawFeeToDecimal(raw: bigint, decimals = 18) {
  const divisor = 10 ** decimals;
  return Number(raw) / divisor;
}

async function getTokenUsdPrice(symbol: "ETH" | "STRK" | "UNKNOWN") {
  if (symbol === "UNKNOWN") {
    return null;
  }

  const cacheKey = symbol;
  const cached = priceCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < 60_000) {
    return cached.priceUsd;
  }

  const coingeckoId = symbol === "ETH" ? "ethereum" : "starknet";

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      {
        headers: {
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const priceUsd = payload?.[coingeckoId]?.usd ?? null;

    priceCache.set(cacheKey, {
      fetchedAt: Date.now(),
      priceUsd: typeof priceUsd === "number" ? priceUsd : null,
    });

    return typeof priceUsd === "number" ? priceUsd : null;
  } catch (error) {
    console.error(`[app-transactions] failed to fetch ${symbol}/USD price`, error);
    priceCache.set(cacheKey, {
      fetchedAt: Date.now(),
      priceUsd: null,
    });
    return null;
  }
}

async function hydrateTransactionFee(
  transaction: {
    id: string;
    network: string;
    txHash: string;
  },
) {
  const network = transaction.network === "mainnet" ? "mainnet" : "sepolia";
  const provider = getProvider(network);

  try {
    const receipt = await provider.getTransactionReceipt(transaction.txHash);
    const actualFee = parseActualFee(receipt);

    if (!actualFee) {
      return;
    }

    const token = getFeeTokenFromUnit(actualFee.unit);
    const tokenPriceUsd = await getTokenUsdPrice(token);
    const actualFeeUsd =
      tokenPriceUsd != null ? (rawFeeToDecimal(actualFee.raw) * tokenPriceUsd).toFixed(6) : null;

    await runPrismaWithRecovery(() =>
      prisma.appTransaction.update({
        where: { id: transaction.id },
        data: {
          actualFeeRaw: actualFee.raw.toString(),
          actualFeeToken: token,
          actualFeeUnit: actualFee.unit,
          actualFeeUsd,
          feeAccountedAt: new Date(),
        },
      }),
    );
  } catch (error) {
    console.warn(`[app-transactions] failed to hydrate fee for ${transaction.txHash}`, error);
  }
}

async function backfillKnownTransactions(walletAddress: string, network: StarknetNetwork) {
  const users = await runPrismaWithRecovery(() =>
    prisma.user.findMany({
      where: {
        starknetAddress: walletAddress,
      },
      select: {
        id: true,
        preferredNetwork: true,
        predictionBets: {
          where: {
            OR: [{ txHash: { not: null } }, { claimTxHash: { not: null } }],
          },
          select: {
            claimTxHash: true,
            network: true,
            txHash: true,
          },
        },
        dcaStrategies: {
          where: {
            txHash: { not: null },
          },
          select: {
            txHash: true,
          },
        },
      },
    }),
  );

  for (const user of users) {
    for (const bet of user.predictionBets) {
      if (bet.txHash) {
        await recordAppTransaction({
          kind: "predict_place",
          network: bet.network === "mainnet" ? "mainnet" : "sepolia",
          sponsoredExecution: true,
          txHash: bet.txHash,
          userId: user.id,
          walletAddress,
        });
      }

      if (bet.claimTxHash) {
        await recordAppTransaction({
          kind: "predict_claim",
          network: bet.network === "mainnet" ? "mainnet" : "sepolia",
          sponsoredExecution: true,
          txHash: bet.claimTxHash,
          userId: user.id,
          walletAddress,
        });
      }
    }

    for (const strategy of user.dcaStrategies) {
      if (!strategy.txHash) {
        continue;
      }

      await recordAppTransaction({
        kind: "dca_create",
        network: user.preferredNetwork === "mainnet" ? "mainnet" : network,
        sponsoredExecution: true,
        txHash: strategy.txHash,
        userId: user.id,
        walletAddress,
      });
    }
  }
}

export async function recordAppTransaction(input: RecordAppTransactionInput) {
  const walletAddress = normalizeHex(input.walletAddress);
  const txHash = normalizeHex(input.txHash);

  return runPrismaWithRecovery(() =>
    prisma.appTransaction.upsert({
      where: { txHash },
      update: {
        explorerUrl: input.explorerUrl ?? undefined,
        kind: input.kind,
        network: input.network,
        sponsoredExecution: input.sponsoredExecution ?? false,
        userId: input.userId,
        walletAddress,
      },
      create: {
        explorerUrl: input.explorerUrl ?? undefined,
        kind: input.kind,
        network: input.network,
        sponsoredExecution: input.sponsoredExecution ?? false,
        txHash,
        userId: input.userId,
        walletAddress,
      },
    }),
  );
}

export async function getGasSavedSummary(walletAddress: string, network: StarknetNetwork) {
  const normalizedWalletAddress = normalizeHex(walletAddress);

  await backfillKnownTransactions(normalizedWalletAddress, network);

  let transactions = await runPrismaWithRecovery(() =>
    prisma.appTransaction.findMany({
      where: {
        walletAddress: normalizedWalletAddress,
        network,
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const pendingHydration = transactions.filter(
    (transaction) => !transaction.feeAccountedAt || !transaction.actualFeeRaw,
  );

  if (pendingHydration.length > 0) {
    await Promise.all(pendingHydration.map((transaction) => hydrateTransactionFee(transaction)));
    transactions = await runPrismaWithRecovery(() =>
      prisma.appTransaction.findMany({
        where: {
          walletAddress: normalizedWalletAddress,
          network,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  const totalUsd = transactions.reduce((sum, transaction) => {
    const value = transaction.actualFeeUsd ? Number(transaction.actualFeeUsd) : 0;
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return {
    display: `$${totalUsd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    totalUsd,
    transactionCount: transactions.filter((transaction) => transaction.actualFeeRaw != null).length,
  };
}
