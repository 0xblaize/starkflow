import { NextRequest, NextResponse } from "next/server";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { BridgeTokenRepository } from "../../../../../node_modules/starkzap/dist/src/bridge/tokens/repository.js";

const bridgeTokenRepository = new BridgeTokenRepository();

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const env = user.preferredNetwork === "mainnet" ? "mainnet" : "testnet";
    const tokens = await bridgeTokenRepository.getTokens({ env });

    return NextResponse.json({
      network: user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
      note: "This Starkzap build supports Ethereum and Solana external bridge connectors.",
      supportedChains: ["ethereum", "solana"],
      tokens: tokens.slice(0, 20).map((token) => ({
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
