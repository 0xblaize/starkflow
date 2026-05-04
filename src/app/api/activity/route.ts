import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/promise-timeout";
import { getRecentWalletActivity } from "@/lib/starknet-read";

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

    const activity = await withTimeout(
      getRecentWalletActivity(address, network),
      6_000,
      "Activity fetch timed out.",
    );
    const normalizedAddress = normalizeAddress(address);

    let addressBook = new Map<
      string,
      {
        username: string | null;
        starknetAddress: string | null;
      }
    >();

    try {
      const counterpartyAddresses = [
        ...new Set(
          activity
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

    const enrichedActivity = activity.map((item) => {
      const counterpartyAddress = normalizeAddress(
        item.direction === "received" ? item.fromAddress : item.toAddress,
      );
      const counterpartyUser = addressBook.get(counterpartyAddress);
      const kind = counterpartyUser
        ? "internal_transfer"
        : item.direction === "received"
          ? "deposit"
          : "transfer";

      return {
        ...item,
        kind,
        counterpartyAddress,
        counterpartyLabel: counterpartyUser?.username
          ? `@${counterpartyUser.username}`
          : shortAddress(counterpartyAddress),
      };
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
