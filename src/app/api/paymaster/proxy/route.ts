import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";

const AVNU_PAYMASTER_URLS = {
  sepolia: "https://sepolia.paymaster.avnu.fi",
  mainnet: "https://starknet.paymaster.avnu.fi",
};

/**
 * Server-side proxy for AVNU paymaster requests.
 * Injects the API key so it's never exposed to the client.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify Privy JWT
    await verifyPrivyToken(req);

    const apiKey = process.env.AVNU_PAYMASTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Paymaster not configured" },
        { status: 503 },
      );
    }

    // Pick paymaster URL based on query param (default: sepolia)
    const url = new URL(req.url);
    const network = url.searchParams.get("network") === "mainnet" ? "mainnet" : "sepolia";
    const baseUrl = AVNU_PAYMASTER_URLS[network];

    const { pathname, search } = url;
    const forwardPath = pathname.replace(/^\/api\/paymaster\/proxy/, "") + search;
    const targetUrl = `${baseUrl}${forwardPath || "/"}`;

    const body = await req.text();

    const avnuRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paymaster-api-key": apiKey,
      },
      body,
    });

    const data = await avnuRes.json();
    return NextResponse.json(data, { status: avnuRes.status });
  } catch (err) {
    console.error("[/api/paymaster/proxy]", err);
    return NextResponse.json(
      { error: "Paymaster proxy error", details: String(err) },
      { status: 500 },
    );
  }
}
