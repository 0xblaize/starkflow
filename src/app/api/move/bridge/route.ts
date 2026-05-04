import { NextRequest, NextResponse } from "next/server";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { withTimeout } from "@/lib/promise-timeout";
import { BridgeTokenRepository } from "../../../../../node_modules/starkzap/dist/src/bridge/tokens/repository.js";

const bridgeTokenRepository = new BridgeTokenRepository();

function normalizeBridgeTokenSymbol(symbol: string) {
  const upper = symbol.toUpperCase();

  if (upper.includes("USDC")) return "USDC";
  if (upper.includes("USDT")) return "USDT";
  if (upper.includes("ETH")) return "ETH";
  if (upper.includes("SOL")) return "SOL";

  return upper;
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );
    const env = user.preferredNetwork === "mainnet" ? "mainnet" : "testnet";
    const allowedChains = new Set(["ethereum", "solana"]);
    const allowedSymbols = new Set(["ETH", "SOL", "USDC", "USDT"]);
    const tokens = await withTimeout(
      bridgeTokenRepository.getTokens({ env }),
      8_000,
      "Bridge routes timed out.",
    );
    const filteredTokens = tokens.filter((token) => {
      if (!allowedChains.has(token.chain)) {
        return false;
      }

      return allowedSymbols.has(normalizeBridgeTokenSymbol(token.symbol));
    });

    return NextResponse.json({
      network: user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
      note:
        "Bridge between Starknet and Ethereum or Solana. Bitcoin bridge is coming soon.",
      supportedChains: ["ethereum", "solana"],
      tokens: filteredTokens.map((token) => ({
        address: token.address,
        bridgeAddress: token.bridgeAddress,
        chain: token.chain,
        decimals: token.decimals,
        id: token.id,
        name: token.name,
        protocol: token.protocol,
        starknetAddress: token.starknetAddress,
        starknetBridge: token.starknetBridge,
        symbol: token.symbol,
      })),
    });
  } catch (error) {
    console.error("[/api/move/bridge][GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load bridge routes.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
