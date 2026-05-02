import { NextRequest, NextResponse } from "next/server";
import { getPrivyClient } from "@/lib/privy-client";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getPrivyStarknetWalletSession } from "@/lib/starkflow-init";

type MoveSignBody = {
  hash?: string;
  privyAuthorizationSignature?: string;
  privyRequestExpiry?: string;
  walletId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const body = (await req.json()) as MoveSignBody;

    if (!body.walletId?.trim()) {
      return NextResponse.json(
        { error: "Missing wallet id." },
        { status: 400 },
      );
    }

    if (!body.hash?.trim()) {
      return NextResponse.json(
        { error: "Missing Starknet hash." },
        { status: 400 },
      );
    }

    if (!body.privyAuthorizationSignature?.trim()) {
      return NextResponse.json(
        { error: "Missing Privy authorization signature." },
        { status: 400 },
      );
    }

    if (!body.privyRequestExpiry?.trim()) {
      return NextResponse.json(
        { error: "Missing Privy request expiry." },
        { status: 400 },
      );
    }

    const session = await getPrivyStarknetWalletSession(claims.sub);

    if (session.walletId !== body.walletId.trim()) {
      return NextResponse.json(
        { error: "Wallet does not belong to the authenticated user." },
        { status: 403 },
      );
    }

    const hash = body.hash.startsWith("0x")
      ? body.hash
      : `0x${body.hash}`;

    const response = await getPrivyClient().wallets()._rawSign(
      session.walletId,
      {
        params: { hash },
        "privy-authorization-signature":
          body.privyAuthorizationSignature.trim(),
        "privy-request-expiry": body.privyRequestExpiry.trim(),
      },
    );

    return NextResponse.json({
      signature: response.data.signature,
    });
  } catch (error) {
    console.error("[/api/move/sign]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sign payload.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
