import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { getGasSavedSummary } from "@/lib/app-transactions";
import { withTimeout } from "@/lib/promise-timeout";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { getReadOnlyWalletBalances } from "@/lib/starknet-read";

const emptyGasSummary = {
  display: "$0.00",
  totalUsd: 0,
  transactionCount: 0,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.trim();
    const requestedNetwork = searchParams.get("network");
    const normalizedNetwork = normalizePreferredNetwork(requestedNetwork);

    if (address) {
      const [balances, gasSummary] = await Promise.all([
        withTimeout(
          getReadOnlyWalletBalances(address, normalizedNetwork),
          6_000,
          "Balance fetch timed out.",
        ),
        withTimeout(
          getGasSavedSummary(address, normalizedNetwork),
          4_000,
          "Gas summary timed out.",
        ).catch(() => emptyGasSummary),
      ]);

      return NextResponse.json(
        {
          ...balances,
          gasSavedDisplay: gasSummary.display,
          gasSavedUsd: gasSummary.totalUsd.toFixed(6),
          trackedTransactionCount: gasSummary.transactionCount,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=8",
          },
        },
      );
    }

    const claims = await verifyPrivyToken(req);
    const appUser = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );

    if (!appUser.starknetAddress) {
      return NextResponse.json(
        {
          address: null,
          btcPriceUsd: null,
          gasSavedDisplay: emptyGasSummary.display,
          gasSavedUsd: emptyGasSummary.totalUsd.toFixed(6),
          network: appUser.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
          portfolioStrkbtc: "0.000000",
          strk: "0.0000 STRK",
          strkPriceUsd: null,
          strkbtc: "0.0000 strkBTC",
          trackedTransactionCount: emptyGasSummary.transactionCount,
          usdc: "0.00 USDC",
          usdTotal: "0.00",
        },
        {
          headers: {
            "Cache-Control": "private, max-age=8",
          },
        },
      );
    }

    const [balances, gasSummary] = await Promise.all([
      withTimeout(
        getReadOnlyWalletBalances(
          appUser.starknetAddress,
          appUser.preferredNetwork,
        ),
        6_000,
        "Balance fetch timed out.",
      ),
      withTimeout(
        getGasSavedSummary(
          appUser.starknetAddress,
          normalizePreferredNetwork(appUser.preferredNetwork),
        ),
        4_000,
        "Gas summary timed out.",
      ).catch(() => emptyGasSummary),
    ]);

    return NextResponse.json(
      {
        ...balances,
        gasSavedDisplay: gasSummary.display,
        gasSavedUsd: gasSummary.totalUsd.toFixed(6),
        trackedTransactionCount: gasSummary.transactionCount,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=8",
        },
      },
    );
  } catch (err) {
    console.error("[/api/balances]", err);
    return NextResponse.json(
      { error: "Failed to fetch balances", details: String(err) },
      { status: err instanceof Error && err.message.includes("token") ? 401 : 500 },
    );
  }
}
