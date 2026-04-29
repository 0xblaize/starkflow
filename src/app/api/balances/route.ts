import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { getReadOnlyWalletBalances } from "@/lib/starknet-read";

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const appUser = await getOrCreatePrivyUser(claims);

    if (!appUser.starknetAddress) {
      return NextResponse.json(
        {
          strk: "0.0000 STRK",
          usdc: "0.00 USDC",
          strkbtc: "0.0000 strkBTC",
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
