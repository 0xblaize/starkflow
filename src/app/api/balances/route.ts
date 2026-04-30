import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { getReadOnlyWalletBalances } from "@/lib/starknet-read";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.trim();
    const requestedNetwork = searchParams.get("network");

    if (address) {
      const balances = await getReadOnlyWalletBalances(
        address,
        normalizePreferredNetwork(requestedNetwork),
      );

      return NextResponse.json(balances, {
        headers: {
          "Cache-Control": "private, max-age=8",
        },
      });
    }

    const claims = await verifyPrivyToken(req);
    const appUser = await getOrCreatePrivyUser(claims);

    if (!appUser.starknetAddress) {
      return NextResponse.json(
        {
          strk: "0.0000 STRK",
          usdc: "0.00 USDC",
          strkbtc: "0.0000 strkBTC",
          portfolioStrkbtc: "0.000000",
          usdTotal: "0.00",
          strkPriceUsd: null,
          btcPriceUsd: null,
          network: appUser.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
          address: null,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=8",
          },
        },
      );
    }

    const balances = await getReadOnlyWalletBalances(
      appUser.starknetAddress,
      appUser.preferredNetwork,
    );

    return NextResponse.json(
      {
        ...balances,
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
