import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPrivyErrorStatus,
  getPrivyWalletJwts,
  verifyPrivyToken,
} from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { initStarkFlow } from "@/lib/starkflow-init";
import type { Address } from "../../../../../node_modules/starkzap/dist/src/types/address.js";
import type { Token } from "../../../../../node_modules/starkzap/dist/src/types/token.js";

type ManagedPositionActionBody =
  | {
      kind?: "prediction";
      positionId?: string;
    }
  | {
      kind?: "dca";
      positionId?: string;
    }
  | {
      collateralTokenAddress?: string;
      collateralTokenDecimals?: number;
      collateralTokenSymbol?: string;
      kind?: "yield";
      poolId?: string;
      positionType?: string;
    };

function toStarkzapToken(token: {
  address: string;
  decimals: number;
  symbol: string;
}): Token {
  return {
    address: token.address as Address,
    decimals: token.decimals,
    name: token.symbol,
    symbol: token.symbol,
  };
}

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as ManagedPositionActionBody;

    if (body.kind === "prediction") {
      const positionId = body.positionId?.trim();

      if (!positionId) {
        return NextResponse.json({ error: "Missing prediction position id." }, { status: 400 });
      }

      const prediction = await prisma.predictionBet.findFirst({
        where: {
          id: positionId,
          userId: user.id,
        },
      });

      if (!prediction) {
        return NextResponse.json({ error: "Prediction position not found." }, { status: 404 });
      }

      if (prediction.status !== "OPEN") {
        return NextResponse.json(
          { error: "Only open prediction positions can be cancelled." },
          { status: 409 },
        );
      }

      if (prediction.executionMode === "ONCHAIN") {
        return NextResponse.json(
          {
            error:
              "Onchain prediction positions are locked in escrow and cannot be cancelled in this version.",
          },
          { status: 409 },
        );
      }

      await prisma.predictionBet.update({
        where: { id: prediction.id },
        data: {
          status: "CANCELLED",
        },
      });

      return NextResponse.json({
        message: `${prediction.marketTitle} cancelled.`,
      });
    }

    if (body.kind === "dca") {
      const positionId = body.positionId?.trim();

      if (!positionId) {
        return NextResponse.json({ error: "Missing DCA position id." }, { status: 400 });
      }

      const strategy = await prisma.dcaStrategy.findFirst({
        where: {
          id: positionId,
          userId: user.id,
        },
      });

      if (!strategy) {
        return NextResponse.json({ error: "DCA strategy not found." }, { status: 404 });
      }

      if (strategy.status === "CLOSED") {
        return NextResponse.json(
          { error: "This DCA strategy is already closed." },
          { status: 409 },
        );
      }

      if (!strategy.orderAddress) {
        return NextResponse.json(
          { error: "This DCA strategy does not have a cancellable order address." },
          { status: 409 },
        );
      }

      const userJwts = getPrivyWalletJwts(req);
      const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });
      const tx = await flow.wallet.dca().cancel(
        {
          orderAddress: strategy.orderAddress as Address,
        },
        flow.deployed ? undefined : { feeMode: "sponsored" },
      );

      await tx.wait();

      await prisma.dcaStrategy.update({
        where: { id: strategy.id },
        data: {
          status: "CLOSED",
        },
      });

      return NextResponse.json({
        message: `${strategy.sellTokenSymbol} to ${strategy.buyTokenSymbol} DCA cancelled.`,
        txHash: tx.hash,
      });
    }

    if (body.kind === "yield") {
      const poolId = body.poolId?.trim();
      const collateralTokenAddress = body.collateralTokenAddress?.trim();
      const collateralTokenSymbol = body.collateralTokenSymbol?.trim();
      const collateralTokenDecimals = body.collateralTokenDecimals;

      if (!poolId || !collateralTokenAddress || !collateralTokenSymbol) {
        return NextResponse.json(
          { error: "Missing yield position details." },
          { status: 400 },
        );
      }

      if (
        typeof collateralTokenDecimals !== "number" ||
        !Number.isInteger(collateralTokenDecimals) ||
        collateralTokenDecimals < 0
      ) {
        return NextResponse.json(
          { error: "Invalid yield token decimals." },
          { status: 400 },
        );
      }

      if (body.positionType !== "earn") {
        return NextResponse.json(
          {
            error:
              "Only earn positions can be withdrawn here. Borrow positions need a repay flow.",
          },
          { status: 409 },
        );
      }

      const userJwts = getPrivyWalletJwts(req);
      const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });
      const tx = await flow.wallet.lending().withdrawMax(
        {
          poolAddress: poolId as Address,
          token: toStarkzapToken({
            address: collateralTokenAddress,
            decimals: collateralTokenDecimals,
            symbol: collateralTokenSymbol,
          }),
        },
        flow.deployed ? undefined : { feeMode: "sponsored" },
      );

      await tx.wait();

      return NextResponse.json({
        message: `${collateralTokenSymbol} withdrawn from yield.`,
        txHash: tx.hash,
      });
    }

    return NextResponse.json({ error: "Unsupported managed position action." }, { status: 400 });
  } catch (error) {
    console.error("[/api/me/positions][POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update managed position.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
