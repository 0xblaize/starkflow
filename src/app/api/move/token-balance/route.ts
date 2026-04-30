import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { findMoveTokenByAddress, readMoveTokenBalance } from "@/lib/move-tokens";

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const { searchParams } = new URL(req.url);
    const tokenAddress = searchParams.get("token")?.trim();

    if (!tokenAddress) {
      return NextResponse.json(
        { error: "Missing token query parameter." },
        { status: 400 },
      );
    }

    const token = findMoveTokenByAddress(user.preferredNetwork, tokenAddress);

    if (!token) {
      return NextResponse.json(
        { error: "Unsupported token." },
        { status: 400 },
      );
    }

    if (!user.starknetAddress) {
      return NextResponse.json({
        address: token.address,
        balanceDisplay: null,
        balanceRaw: null,
      });
    }

    const balance = await readMoveTokenBalance(
      user.preferredNetwork,
      user.starknetAddress,
      token,
    );

    return NextResponse.json({
      address: token.address,
      ...balance,
    });
  } catch (error) {
    console.error("[/api/move/token-balance]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load token balance.",
      },
      { status: 500 },
    );
  }
}
