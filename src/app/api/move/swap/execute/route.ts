import { NextRequest, NextResponse } from "next/server";
import { recordAppTransaction } from "@/lib/app-transactions";
import { getPrivyErrorStatus, getPrivyWalletJwts, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { findMoveTokenByAddress } from "@/lib/move-tokens";
import {
  executeSwapForMode,
  formatSwapModeError,
  getSwapQuoteForMode,
  type SwapProviderMode,
} from "@/lib/swap-provider";
import { initStarkFlow } from "@/lib/starkflow-init";
import { Amount } from "../../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type { Token } from "../../../../../../node_modules/starkzap/dist/src/types/token.js";

type SwapExecutionReceipt = {
  explorerUrl?: string;
  hash: string;
};

export async function POST(req: NextRequest) {
  let providerMode: SwapProviderMode = "AUTO";

  try {
    const claims = await verifyPrivyToken(req);
    const userJwts = getPrivyWalletJwts(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as {
      amount?: string;
      providerMode?: SwapProviderMode;
      slippageBps?: number;
      tokenInAddress?: string;
      tokenOutAddress?: string;
    };
    providerMode = body.providerMode ?? "AUTO";

    if (!body.tokenInAddress?.trim() || !body.tokenOutAddress?.trim()) {
      return NextResponse.json(
        { error: "Choose both swap tokens." },
        { status: 400 },
      );
    }

    const tokenIn = findMoveTokenByAddress(user.preferredNetwork, body.tokenInAddress);
    const tokenOut = findMoveTokenByAddress(user.preferredNetwork, body.tokenOutAddress);

    if (!tokenIn || !tokenOut) {
      return NextResponse.json(
        { error: "Unsupported token selection." },
        { status: 400 },
      );
    }

    if (tokenIn.address === tokenOut.address) {
      return NextResponse.json(
        { error: "Choose different tokens for the swap." },
        { status: 400 },
      );
    }

    if (!body.amount?.trim()) {
      return NextResponse.json(
        { error: "Enter an amount to swap." },
        { status: 400 },
      );
    }

    const flow = await initStarkFlow(user.id, userJwts, { deploy: "if_needed" });
    const starkzapTokenIn: Token = {
      address: tokenIn.address,
      decimals: tokenIn.decimals,
      name: tokenIn.name,
      symbol: tokenIn.symbol,
      ...(tokenIn.metadata ? { metadata: tokenIn.metadata } : {}),
    };
    const starkzapTokenOut: Token = {
      address: tokenOut.address,
      decimals: tokenOut.decimals,
      name: tokenOut.name,
      symbol: tokenOut.symbol,
      ...(tokenOut.metadata ? { metadata: tokenOut.metadata } : {}),
    };
    const amountIn = Amount.parse(body.amount, tokenIn.decimals, tokenIn.symbol);
    const quote = await getSwapQuoteForMode(
      flow.wallet,
      {
        tokenIn: starkzapTokenIn,
        tokenOut: starkzapTokenOut,
        amountIn,
        slippageBps: BigInt(body.slippageBps ?? 100),
      },
      providerMode,
    );
    const tx = await executeSwapForMode<SwapExecutionReceipt>(
      flow.wallet,
      {
        tokenIn: starkzapTokenIn,
        tokenOut: starkzapTokenOut,
        amountIn,
        slippageBps: BigInt(body.slippageBps ?? 100),
      },
      providerMode,
    );

    if (user.starknetAddress) {
      await recordAppTransaction({
        explorerUrl: tx.tx.explorerUrl,
        kind: "swap",
        network: flow.network === "mainnet" ? "mainnet" : "sepolia",
        sponsoredExecution: !flow.deployed,
        txHash: tx.tx.hash,
        userId: user.id,
        walletAddress: user.starknetAddress,
      });
    }

    return NextResponse.json({
      amountIn: amountIn.toFormatted(),
      amountOut: Amount.fromRaw(
        quote.quote.amountOutBase,
        tokenOut.decimals,
        tokenOut.symbol,
      ).toFormatted(),
      explorerUrl: tx.tx.explorerUrl,
      fallbackTriggered: tx.fallbackTriggered || quote.fallbackTriggered,
      priceImpactBps: quote.quote.priceImpactBps?.toString() ?? null,
      provider: tx.providerUsed,
      providerMode: tx.providerMode,
      routeCallCount: quote.quote.routeCallCount ?? null,
      tokenIn,
      tokenOut,
      txHash: tx.tx.hash,
    });
  } catch (error) {
    console.error("[/api/move/swap/execute]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.includes("not deployed")
                ? "Swap contract not found on this network. Switch to Mainnet in Settings."
                : formatSwapModeError(error, providerMode)
            : "Failed to execute swap.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
