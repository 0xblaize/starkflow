import { NextRequest, NextResponse } from "next/server";
import { getPrivyBearerToken, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { resolveMoveRecipient } from "@/lib/move-recipient";
import { findMoveTokenByAddress } from "@/lib/move-tokens";
import { initStarkFlow } from "@/lib/starkflow-init";
import { Amount } from "../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type { Address } from "../../../../../node_modules/starkzap/dist/src/types/address.js";
import type { Token } from "../../../../../node_modules/starkzap/dist/src/types/token.js";

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwt = getPrivyBearerToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as {
      amount?: string;
      recipientQuery?: string;
      tokenAddress?: string;
    };

    if (!body.recipientQuery?.trim()) {
      return NextResponse.json(
        { error: "Enter a username or Starknet address." },
        { status: 400 },
      );
    }

    if (!body.tokenAddress?.trim()) {
      return NextResponse.json(
        { error: "Choose a token to send." },
        { status: 400 },
      );
    }

    if (!body.amount?.trim()) {
      return NextResponse.json(
        { error: "Enter an amount to send." },
        { status: 400 },
      );
    }

    const token = findMoveTokenByAddress(user.preferredNetwork, body.tokenAddress);

    if (!token) {
      return NextResponse.json(
        { error: "Unsupported token for send." },
        { status: 400 },
      );
    }

    const recipient = await resolveMoveRecipient(body.recipientQuery);
    const flow = await initStarkFlow(user.id, { deploy: "if_needed" });
    const starkzapToken: Token = {
      address: token.address,
      decimals: token.decimals,
      name: token.name,
      symbol: token.symbol,
      ...(token.metadata ? { metadata: token.metadata } : {}),
    };
    const amount = Amount.parse(body.amount, token.decimals, token.symbol);
    const tx = await flow.wallet.transfer(
      starkzapToken,
      [
        {
          to: recipient.address as Address,
          amount,
        },
      ],
      flow.deployed ? undefined : { feeMode: "sponsored" },
    );

    return NextResponse.json({
      amount: amount.toFormatted(),
      explorerUrl: tx.explorerUrl,
      isInternal: recipient.isInternal,
      recipient: {
        address: recipient.address,
        username: recipient.username,
      },
      symbol: token.symbol,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("[/api/move/send]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to execute send.",
      },
      { status: 500 },
    );
  }
}
