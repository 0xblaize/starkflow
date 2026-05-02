import { NextRequest, NextResponse } from "next/server";
import { formatRequestForAuthorizationSignature } from "@privy-io/node";
import { getPrivyAppId } from "@/lib/privy-client";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getPrivyStarknetWalletSession } from "@/lib/starkflow-init";

type MoveSignPayloadBody = {
  hash?: string;
  walletId?: string;
};

const PRIVY_API_BASE_URL = "https://api.privy.io";

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const body = (await req.json()) as MoveSignPayloadBody;

    if (!body.walletId?.trim()) {
      return NextResponse.json({ error: "Missing wallet id." }, { status: 400 });
    }

    if (!body.hash?.trim()) {
      return NextResponse.json({ error: "Missing Starknet hash." }, { status: 400 });
    }

    const session = await getPrivyStarknetWalletSession(claims.sub);

    if (session.walletId !== body.walletId.trim()) {
      return NextResponse.json(
        { error: "Wallet does not belong to the authenticated user." },
        { status: 403 },
      );
    }

    const walletId = body.walletId.trim();
    const hash = body.hash.startsWith("0x") ? body.hash : `0x${body.hash}`;
    const privyRequestExpiry = String(Date.now() + 5 * 60 * 1000);
    const payload = formatRequestForAuthorizationSignature({
      version: 1,
      method: "POST",
      url: `${PRIVY_API_BASE_URL}/v1/wallets/${walletId}/raw_sign`,
      body: {
        params: { hash },
      },
      headers: {
        "privy-app-id": getPrivyAppId(),
        "privy-request-expiry": privyRequestExpiry,
      },
    });

    return NextResponse.json({
      hash,
      payload: Buffer.from(payload).toString("base64"),
      privyRequestExpiry,
      walletId,
    });
  } catch (error) {
    console.error("[/api/move/sign-payload]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare sign payload.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
