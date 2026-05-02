import { NextRequest, NextResponse } from "next/server";
import { getPrivyBearerToken, getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { findMoveTokenByAddress } from "@/lib/move-tokens";
import { initStarkFlow } from "@/lib/starkflow-init";
import { Amount } from "../../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type { Token } from "../../../../../../node_modules/starkzap/dist/src/types/token.js";

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwt = getPrivyBearerToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as {
      amount?: string;
      slippageBps?: number;
      tokenInAddress?: string;
      tokenOutAddress?: string;
    };

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
        { error: "Enter an amount to quote." },
        { status: 400 },
      );
    }

    const flow = await initStarkFlow(user.id, userJwt, { deploy: "never" });
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
    const quote = await flow.wallet.getQuote({
      tokenIn: starkzapTokenIn,
      tokenOut: starkzapTokenOut,
      amountIn,
      provider: "avnu",
      slippageBps: BigInt(body.slippageBps ?? 100),
    });

    return NextResponse.json({
      amountIn: amountIn.toFormatted(),
      amountOut: Amount.fromRaw(
        quote.amountOutBase,
        tokenOut.decimals,
        tokenOut.symbol,
      ).toFormatted(),
      priceImpactBps: quote.priceImpactBps?.toString() ?? null,
      provider: quote.provider ?? "avnu",
      routeCallCount: quote.routeCallCount ?? null,
      tokenIn,
      tokenOut,
    });
  } catch (error) {
    console.error("[/api/move/swap/quote]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch swap quote.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
