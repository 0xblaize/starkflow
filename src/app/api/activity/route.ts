import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import type { AppTransactionKind } from "@/lib/app-transactions";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/promise-timeout";
import { getRecentWalletActivity } from "@/lib/starknet-read";

type TransferActivity = NonNullable<
  Awaited<ReturnType<typeof getRecentWalletActivity>>[number]
>;

type AddressBookEntry = {
  username: string | null;
  starknetAddress: string | null;
};

type ActivityKind =
  | "deposit"
  | "internal_transfer"
  | "transfer"
  | AppTransactionKind;

type EnrichedActivityItem = {
  amount: string;
  badge: string;
  badgeTone: "brand" | "neutral" | "positive" | "negative";
  blockNumber: number | null;
  contractAddress: string;
  counterpartyAddress?: string;
  counterpartyLabel?: string;
  createdAt?: string;
  direction: "received" | "sent";
  fromAddress?: string;
  id: string;
  kind: ActivityKind;
  label: string;
  meta: string;
  symbol: string;
  toAddress?: string;
  txHash: string;
};

function normalizeAddress(value: string) {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value.toLowerCase();
  }
}

function shortAddress(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function shortTxHash(value: string) {
  return `${value.slice(0, 12)}...`;
}

function pushMeta(parts: Array<string>, value: string | null | undefined) {
  if (value) {
    parts.push(value);
  }
}

function getCounterpartyLabel(
  address: string | null | undefined,
  addressBook: Map<string, AddressBookEntry>,
) {
  if (!address) {
    return null;
  }

  const normalized = normalizeAddress(address);
  const knownUser = addressBook.get(normalized);

  if (knownUser?.username) {
    return `@${knownUser.username}`;
  }

  return shortAddress(normalized);
}

function buildTransferActivityItem(
  item: TransferActivity,
  addressBook: Map<string, AddressBookEntry>,
  normalizedWalletAddress: string,
): EnrichedActivityItem {
  const counterpartyAddress = normalizeAddress(
    item.direction === "received" ? item.fromAddress : item.toAddress,
  );
  const counterpartyUser = addressBook.get(counterpartyAddress);
  const kind: ActivityKind = counterpartyUser
    ? "internal_transfer"
    : item.direction === "received"
      ? "deposit"
      : "transfer";
  const counterpartyLabel = counterpartyUser?.username
    ? `@${counterpartyUser.username}`
    : shortAddress(counterpartyAddress);
  const label =
    kind === "internal_transfer"
      ? item.direction === "received"
        ? `Transfer from ${counterpartyLabel}`
        : `Transfer to ${counterpartyLabel}`
      : item.direction === "received"
        ? `Received ${item.amount} ${item.symbol}`
        : `Sent ${item.amount} ${item.symbol}`;
  const metaParts: string[] = [];

  pushMeta(
    metaParts,
    item.direction === "received"
      ? `From ${counterpartyLabel}`
      : `To ${counterpartyLabel}`,
  );
  pushMeta(metaParts, `Tx ${shortTxHash(item.txHash)}`);

  return {
    ...item,
    badge: kind === "internal_transfer" ? "Transfer" : item.direction === "received" ? "Receive" : "Send",
    badgeTone:
      kind === "internal_transfer"
        ? "brand"
        : item.direction === "received"
          ? "positive"
          : "negative",
    blockNumber: item.blockNumber ?? null,
    counterpartyAddress:
      counterpartyAddress === normalizedWalletAddress ? undefined : counterpartyAddress,
    counterpartyLabel,
    kind,
    label,
    meta: metaParts.join(" · "),
  };
}

function buildAppActivityItem(params: {
  addressBook: Map<string, AddressBookEntry>;
  dcaByTxHash: Map<
    string,
    {
      buyTokenSymbol: string;
      frequency: string;
      sellAmount: string;
      sellTokenSymbol: string;
    }
  >;
  predictionClaimByTxHash: Map<
    string,
    {
      marketTitle: string;
      payoutAmount: string | null;
      stakeCurrency: string;
    }
  >;
  predictionPlaceByTxHash: Map<
    string,
    {
      marketTitle: string;
      outcome: string;
      stakeAmount: string;
      stakeCurrency: string;
    }
  >;
  transaction: {
    createdAt: Date;
    kind: string;
    sponsoredExecution: boolean;
    txHash: string;
  };
  transfers: TransferActivity[];
}) {
  const { addressBook, dcaByTxHash, predictionClaimByTxHash, predictionPlaceByTxHash, transaction, transfers } =
    params;
  const sentTransfers = transfers.filter((item) => item.direction === "sent");
  const receivedTransfers = transfers.filter((item) => item.direction === "received");
  const primarySent = sentTransfers[0] ?? null;
  const primaryReceived = receivedTransfers[0] ?? null;
  const txHash = normalizeAddress(transaction.txHash);
  const metaParts = [`Tx ${shortTxHash(txHash)}`];

  if (transaction.sponsoredExecution) {
    metaParts.push("Sponsored");
  }

  const blockNumber =
    transfers.length > 0
      ? Math.max(...transfers.map((item) => item.blockNumber ?? 0))
      : null;
  const appKind = transaction.kind as AppTransactionKind;

  const base = {
    amount: primarySent?.amount ?? primaryReceived?.amount ?? "—",
    blockNumber,
    contractAddress: primarySent?.contractAddress ?? primaryReceived?.contractAddress ?? "",
    counterpartyAddress:
      primarySent?.toAddress ?? primaryReceived?.fromAddress ?? undefined,
    counterpartyLabel: getCounterpartyLabel(
      primarySent?.toAddress ?? primaryReceived?.fromAddress ?? undefined,
      addressBook,
    ) ?? undefined,
    createdAt: transaction.createdAt.toISOString(),
    direction:
      primaryReceived && !primarySent
        ? ("received" as const)
        : ("sent" as const),
    fromAddress: primarySent?.fromAddress ?? primaryReceived?.fromAddress ?? undefined,
    id: `app:${txHash}`,
    kind: appKind,
    symbol: primarySent?.symbol ?? primaryReceived?.symbol ?? "APP",
    toAddress: primarySent?.toAddress ?? primaryReceived?.toAddress ?? undefined,
    txHash,
  };

  if (appKind === "send") {
    const counterpartyLabel =
      getCounterpartyLabel(primarySent?.toAddress, addressBook) ?? "recipient";
    pushMeta(metaParts, `To ${counterpartyLabel}`);

    return {
      ...base,
      badge: "Send",
      badgeTone: "negative" as const,
      label: primarySent
        ? `Sent ${primarySent.amount} ${primarySent.symbol} to ${counterpartyLabel}`
        : `Sent transfer to ${counterpartyLabel}`,
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "swap") {
    const label =
      primarySent && primaryReceived
        ? `Swapped ${primarySent.amount} ${primarySent.symbol} for ${primaryReceived.amount} ${primaryReceived.symbol}`
        : primarySent
          ? `Swap executed from ${primarySent.symbol}`
          : "Swap executed";

    return {
      ...base,
      badge: "Swap",
      badgeTone: "brand" as const,
      label,
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "predict_place") {
    const prediction = predictionPlaceByTxHash.get(txHash);
    pushMeta(metaParts, prediction?.marketTitle ?? null);

    return {
      ...base,
      badge: "Bet",
      badgeTone: "brand" as const,
      label: prediction
        ? `${prediction.outcome} bet opened · ${prediction.stakeAmount} ${prediction.stakeCurrency}`
        : "Prediction opened",
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "predict_claim") {
    const claim = predictionClaimByTxHash.get(txHash);
    pushMeta(metaParts, claim?.marketTitle ?? null);

    return {
      ...base,
      badge: "Claim",
      badgeTone: "positive" as const,
      direction: "received" as const,
      label: claim?.payoutAmount
        ? `Prediction claimed · ${claim.payoutAmount} ${claim.stakeCurrency}`
        : "Prediction claimed",
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "yield_deposit") {
    return {
      ...base,
      badge: "Yield",
      badgeTone: "brand" as const,
      label: primarySent
        ? `Yield deposit · ${primarySent.amount} ${primarySent.symbol}`
        : "Yield deposit",
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "yield_withdraw") {
    return {
      ...base,
      badge: "Yield",
      badgeTone: "positive" as const,
      direction: "received" as const,
      label: primaryReceived
        ? `Yield withdrawal · ${primaryReceived.amount} ${primaryReceived.symbol}`
        : "Yield withdrawal",
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "dca_create") {
    const dca = dcaByTxHash.get(txHash);
    pushMeta(metaParts, dca?.frequency ?? null);

    return {
      ...base,
      badge: "DCA",
      badgeTone: "brand" as const,
      label: dca
        ? `DCA started · ${dca.sellAmount} ${dca.sellTokenSymbol} into ${dca.buyTokenSymbol}`
        : "DCA started",
      meta: metaParts.join(" · "),
    };
  }

  if (appKind === "dca_cancel") {
    return {
      ...base,
      badge: "DCA",
      badgeTone: "neutral" as const,
      label: "DCA cancelled",
      meta: metaParts.join(" · "),
    };
  }

  return {
    ...base,
    badge: "Activity",
    badgeTone: "neutral" as const,
    label: "Wallet activity",
    meta: metaParts.join(" · "),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.trim();
    const network = normalizePreferredNetwork(searchParams.get("network"));

    if (!address) {
      return NextResponse.json(
        { error: "Missing address query parameter." },
        { status: 400 },
      );
    }

    const normalizedAddress = normalizeAddress(address);
    const [transferActivity, appTransactions] = await Promise.all([
      withTimeout(
        getRecentWalletActivity(address, network),
        6_000,
        "Activity fetch timed out.",
      ),
      withTimeout(
        prisma.appTransaction.findMany({
          where: {
            walletAddress: normalizedAddress,
            network,
          },
          orderBy: { createdAt: "desc" },
          select: {
            createdAt: true,
            kind: true,
            sponsoredExecution: true,
            txHash: true,
          },
        }),
        3_500,
        "Transaction ledger lookup timed out.",
      ).catch(() => []),
    ]);

    const txHashes = appTransactions.map((transaction) => normalizeAddress(transaction.txHash));
    const [predictionRows, dcaRows] = await Promise.all([
      txHashes.length > 0
        ? withTimeout(
            prisma.predictionBet.findMany({
              where: {
                OR: [
                  { txHash: { in: txHashes } },
                  { claimTxHash: { in: txHashes } },
                ],
              },
              select: {
                claimTxHash: true,
                marketTitle: true,
                outcome: true,
                payoutAmount: true,
                stakeAmount: true,
                stakeCurrency: true,
                txHash: true,
              },
            }),
            3_500,
            "Prediction metadata lookup timed out.",
          ).catch(() => [])
        : Promise.resolve([]),
      txHashes.length > 0
        ? withTimeout(
            prisma.dcaStrategy.findMany({
              where: {
                txHash: { in: txHashes },
              },
              select: {
                buyTokenSymbol: true,
                frequency: true,
                sellAmount: true,
                sellTokenSymbol: true,
                txHash: true,
              },
            }),
            3_500,
            "DCA metadata lookup timed out.",
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

    const transfers = transferActivity.filter(
      (item): item is TransferActivity => item != null,
    );
    const transfersByTxHash = new Map<string, TransferActivity[]>();

    for (const item of transfers) {
      const txHash = normalizeAddress(item.txHash);
      const items = transfersByTxHash.get(txHash) ?? [];
      items.push(item);
      transfersByTxHash.set(txHash, items);
    }

    let addressBook = new Map<string, AddressBookEntry>();

    try {
      const counterpartyAddresses = [
        ...new Set(
          transfers
            .flatMap((item) => [item.fromAddress, item.toAddress])
            .map((value) => normalizeAddress(value))
            .filter((value) => value !== normalizedAddress),
        ),
      ];

      if (counterpartyAddresses.length > 0) {
        const knownUsers = await withTimeout(
          prisma.user.findMany({
            where: {
              starknetAddress: {
                in: counterpartyAddresses,
              },
            },
            select: {
              username: true,
              starknetAddress: true,
            },
          }),
          3_000,
          "Address book lookup timed out.",
        );

        addressBook = new Map(
          knownUsers
            .filter((user) => Boolean(user.starknetAddress))
            .map((user) => [
              normalizeAddress(user.starknetAddress!),
              {
                username: user.username ?? null,
                starknetAddress: user.starknetAddress,
              },
            ]),
        );
      }
    } catch (error) {
      console.error("[/api/activity] failed to enrich counterparties", error);
    }

    const predictionPlaceByTxHash = new Map(
      predictionRows
        .filter((row) => row.txHash)
        .map((row) => [
          normalizeAddress(row.txHash!),
          {
            marketTitle: row.marketTitle,
            outcome: row.outcome,
            stakeAmount: row.stakeAmount,
            stakeCurrency: row.stakeCurrency,
          },
        ]),
    );
    const predictionClaimByTxHash = new Map(
      predictionRows
        .filter((row) => row.claimTxHash)
        .map((row) => [
          normalizeAddress(row.claimTxHash!),
          {
            marketTitle: row.marketTitle,
            payoutAmount: row.payoutAmount,
            stakeCurrency: row.stakeCurrency,
          },
        ]),
    );
    const dcaByTxHash = new Map(
      dcaRows
        .filter((row) => row.txHash)
        .map((row) => [
          normalizeAddress(row.txHash!),
          {
            buyTokenSymbol: row.buyTokenSymbol,
            frequency: row.frequency,
            sellAmount: row.sellAmount,
            sellTokenSymbol: row.sellTokenSymbol,
          },
        ]),
    );

    const appTxHashSet = new Set(txHashes);

    const appActivityItems = appTransactions.map((transaction) =>
      buildAppActivityItem({
        addressBook,
        dcaByTxHash,
        predictionClaimByTxHash,
        predictionPlaceByTxHash,
        transaction: {
          ...transaction,
          txHash: normalizeAddress(transaction.txHash),
        },
        transfers: transfersByTxHash.get(normalizeAddress(transaction.txHash)) ?? [],
      }),
    );

    const transferItems = transfers
      .filter((item) => !appTxHashSet.has(normalizeAddress(item.txHash)))
      .map((item) => buildTransferActivityItem(item, addressBook, normalizedAddress));

    const enrichedActivity = [...appActivityItems, ...transferItems].sort((left, right) => {
      const leftBlock = left.blockNumber ?? -1;
      const rightBlock = right.blockNumber ?? -1;

      if (rightBlock !== leftBlock) {
        return rightBlock - leftBlock;
      }

      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.txHash.localeCompare(left.txHash);
    });

    return NextResponse.json(
      {
        address,
        network,
        activity: enrichedActivity,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=8",
        },
      },
    );
  } catch (error) {
    console.error("[/api/activity]", error);
    return NextResponse.json(
      { error: "Failed to fetch activity." },
      { status: 500 },
    );
  }
}
