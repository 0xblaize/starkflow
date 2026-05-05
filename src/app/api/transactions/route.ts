import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import {
  APP_TRANSACTION_KINDS,
  type AppTransactionKind,
  recordAppTransaction,
} from "@/lib/app-transactions";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";

type RecordTransactionBody = {
  explorerUrl?: string;
  kind?: string;
  network?: string;
  sponsoredExecution?: boolean;
  txHash?: string;
};

const appTransactionKinds = new Set<string>(APP_TRANSACTION_KINDS);

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as RecordTransactionBody;
    const txHash = body.txHash?.trim();
    const kind = body.kind?.trim();

    if (!txHash) {
      return NextResponse.json({ error: "Missing transaction hash." }, { status: 400 });
    }

    if (!kind || !appTransactionKinds.has(kind)) {
      return NextResponse.json({ error: "Unsupported transaction kind." }, { status: 400 });
    }

    if (!user.starknetAddress) {
      return NextResponse.json({ error: "User wallet address is unavailable." }, { status: 409 });
    }

    await recordAppTransaction({
      explorerUrl: body.explorerUrl ?? null,
      kind: kind as AppTransactionKind,
      network: normalizePreferredNetwork(body.network ?? user.preferredNetwork),
      sponsoredExecution: body.sponsoredExecution ?? false,
      txHash,
      userId: user.id,
      walletAddress: user.starknetAddress,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/transactions][POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to record transaction.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
