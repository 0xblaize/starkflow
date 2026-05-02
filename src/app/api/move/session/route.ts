import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getPrivyStarknetWalletSession } from "@/lib/starkflow-init";

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const { searchParams } = new URL(req.url);
    const preferredNetwork = normalizePreferredNetwork(
      searchParams.get("network"),
    );
    const session = await getPrivyStarknetWalletSession(
      claims.sub,
      preferredNetwork,
    );

    return NextResponse.json(session, {
      headers: {
        "Cache-Control": "private, max-age=20",
      },
    });
  } catch (error) {
    console.error("[/api/move/session]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load wallet session.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
