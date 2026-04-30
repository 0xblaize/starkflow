import { NextRequest, NextResponse } from "next/server";
import { resolveMoveRecipient, shortAddress } from "@/lib/move-recipient";
import { verifyPrivyToken } from "@/lib/privy-server";

export async function POST(req: NextRequest) {
  try {
    await verifyPrivyToken(req);
    const body = (await req.json()) as { query?: string };
    const query = body.query?.trim() ?? "";

    const recipient = await resolveMoveRecipient(query);

    return NextResponse.json({
      ...recipient,
      addressShort: shortAddress(recipient.address),
      usernameHandle: recipient.username ? `@${recipient.username}.stark` : null,
    });
  } catch (error) {
    console.error("[/api/move/recipient]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to resolve recipient.",
      },
      { status: 400 },
    );
  }
}
