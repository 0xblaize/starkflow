import { NextRequest, NextResponse } from "next/server";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";

const avnuApiKey = process.env.AVNU_PAYMASTER_API_KEY;

function getPaymasterUrl(network: "mainnet" | "sepolia") {
  return network === "mainnet"
    ? "https://starknet.paymaster.avnu.fi"
    : "https://sepolia.paymaster.avnu.fi";
}

export async function POST(req: NextRequest) {
  try {
    if (!avnuApiKey) {
      return NextResponse.json(
        { error: "AVNU paymaster is not configured." },
        { status: 503 },
      );
    }

    await verifyPrivyToken(req);

    const { searchParams } = new URL(req.url);
    const network = normalizePreferredNetwork(
      searchParams.get("network"),
    ) as "mainnet" | "sepolia";
    const upstream = await fetch(getPaymasterUrl(network), {
      method: "POST",
      headers: {
        "Content-Type":
          req.headers.get("content-type") ?? "application/json",
        "x-paymaster-api-key": avnuApiKey,
      },
      body: await req.text(),
    });
    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("[/api/move/paymaster]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach the paymaster.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
