import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { readMoveTokenBalance, searchVerifiedMoveTokens } from "@/lib/move-tokens";

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = Number(searchParams.get("limit") ?? "24");
    const includeBalances = searchParams.get("balances") === "1";
    const tokens = searchVerifiedMoveTokens(
      user.preferredNetwork,
      query,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 40) : 24,
    );

    const withBalances = includeBalances
      ? await Promise.all(
          tokens.map(async (token) => {
            if (!user.starknetAddress) {
              return {
                ...token,
                balanceDisplay: null,
                balanceRaw: null,
                verified: true,
              };
            }

            const balance = await readMoveTokenBalance(
              user.preferredNetwork,
              user.starknetAddress,
              token,
            );

            return {
              ...token,
              ...balance,
              verified: true,
            };
          }),
        )
      : tokens.map((token) => ({
          ...token,
          balanceDisplay: null,
          balanceRaw: null,
          verified: true,
        }));

    return NextResponse.json(
      {
        network: user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
        tokens: withBalances,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=10",
        },
      },
    );
  } catch (error) {
    console.error("[/api/move/tokens]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load verified tokens.",
      },
      { status: 500 },
    );
  }
}
