import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrivyErrorStatus, getPrivyWalletJwts, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { findMoveTokenByAddress } from "@/lib/move-tokens";
import { initStarkFlow } from "@/lib/starkflow-init";
import { Amount } from "../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type { DcaOrder } from "../../../../../node_modules/starkzap/dist/src/dca/interface.js";
import type { Address } from "../../../../../node_modules/starkzap/dist/src/types/address.js";
import type { Token } from "../../../../../node_modules/starkzap/dist/src/types/token.js";

type DcaIntent = "preview" | "create";

function toStarkzapToken(token: {
  address: string;
  decimals: number;
  metadata?: { logoUrl?: URL };
  name: string;
  symbol: string;
}): Token {
  return {
    address: token.address as Address,
    decimals: token.decimals,
    name: token.name,
    symbol: token.symbol,
    ...(token.metadata ? { metadata: token.metadata } : {}),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForCreatedOrder(
  flow: Awaited<ReturnType<typeof initStarkFlow>>,
  txHash: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const page = await flow.wallet.dca().getOrders({
      size: 20,
    });

    const order = page.content.find(
      (entry: DcaOrder) =>
        entry.creationTransactionHash?.toLowerCase() === txHash.toLowerCase(),
    );

    if (order) {
      return order;
    }

    await sleep(2_000);
  }

  return null;
}

function formatBigintAmount(
  rawValue: bigint,
  decimals: number,
  symbol: string,
  fractionDigits = 4,
) {
  return Amount.fromRaw(rawValue, decimals, symbol)
    .toFormatted(fractionDigits <= 4)
    .replace(/\s+/g, " ");
}

function resolveDcaFrequency(raw: string | undefined) {
  const value = raw?.trim() || "P1D";
  const supported = new Set(["PT1H", "PT6H", "P1D", "P1W"]);

  if (!supported.has(value)) {
    throw new Error("Unsupported DCA frequency.");
  }

  return value;
}

function sortOrdersByNewest(orders: DcaOrder[]) {
  return [...orders].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwts = getPrivyWalletJwts(req);
    const user = await getOrCreatePrivyUser(claims);
    const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });
    const liveOrders = await flow.wallet.dca().getOrders({
      size: 20,
    });

    const mappedOrders = await Promise.all(
      sortOrdersByNewest(liveOrders.content).map(async (order: DcaOrder) => {
        const sellToken =
          findMoveTokenByAddress(user.preferredNetwork, order.sellTokenAddress) ??
          null;
        const buyToken =
          findMoveTokenByAddress(user.preferredNetwork, order.buyTokenAddress) ??
          null;

        const summary = {
          createdAt: order.timestamp.toISOString(),
          frequency: order.frequency,
          orderAddress: order.orderAddress,
          providerId: order.providerId,
          sellAmount: sellToken
            ? formatBigintAmount(
                order.sellAmountBase,
                sellToken.decimals,
                sellToken.symbol,
              )
            : order.sellAmountBase.toString(),
          sellAmountPerCycle: sellToken
            ? formatBigintAmount(
                order.sellAmountPerCycleBase ?? BigInt(0),
                sellToken.decimals,
                sellToken.symbol,
              )
            : (order.sellAmountPerCycleBase ?? BigInt(0)).toString(),
          sellTokenSymbol: sellToken?.symbol ?? shortAddress(order.sellTokenAddress),
          strategyId: order.id,
          status: order.status,
          txHash: order.creationTransactionHash ?? null,
          buyTokenSymbol: buyToken?.symbol ?? shortAddress(order.buyTokenAddress),
        };

        await prisma.dcaStrategy.upsert({
          where: { strategyId: order.id },
          update: {
            frequency: summary.frequency,
            orderAddress: summary.orderAddress,
            providerId: summary.providerId,
            sellAmount: summary.sellAmount,
            sellPerCycle: summary.sellAmountPerCycle,
            sellTokenSymbol: summary.sellTokenSymbol,
            status: summary.status,
            txHash: summary.txHash,
            buyTokenSymbol: summary.buyTokenSymbol,
          },
          create: {
            userId: user.id,
            frequency: summary.frequency,
            orderAddress: summary.orderAddress,
            providerId: summary.providerId,
            sellAmount: summary.sellAmount,
            sellPerCycle: summary.sellAmountPerCycle,
            sellTokenSymbol: summary.sellTokenSymbol,
            strategyId: summary.strategyId,
            status: summary.status,
            txHash: summary.txHash,
            buyTokenSymbol: summary.buyTokenSymbol,
          },
        });

        return summary;
      }),
    );

    return NextResponse.json({
      network: flow.network,
      orders: mappedOrders,
    });
  } catch (error) {
    console.error("[/api/move/dca][GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load DCA strategies.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwts = getPrivyWalletJwts(req);
    const user = await getOrCreatePrivyUser(claims);
    const body = (await req.json()) as {
      buyTokenAddress?: string;
      frequency?: string;
      intent?: DcaIntent;
      maxBuyAmount?: string;
      minBuyAmount?: string;
      sellAmount?: string;
      sellAmountPerCycle?: string;
      sellTokenAddress?: string;
      slippageBps?: number;
    };

    const intent = body.intent ?? "preview";
    const sellTokenAddress = body.sellTokenAddress?.trim();
    const buyTokenAddress = body.buyTokenAddress?.trim();

    if (!sellTokenAddress || !buyTokenAddress) {
      return NextResponse.json(
        { error: "Choose both DCA tokens." },
        { status: 400 },
      );
    }

    const sellToken = findMoveTokenByAddress(
      user.preferredNetwork,
      sellTokenAddress,
    );
    const buyToken = findMoveTokenByAddress(
      user.preferredNetwork,
      buyTokenAddress,
    );

    if (!sellToken || !buyToken) {
      return NextResponse.json(
        { error: "Unsupported DCA token selection." },
        { status: 400 },
      );
    }

    if (sellToken.address === buyToken.address) {
      return NextResponse.json(
        { error: "Choose different DCA tokens." },
        { status: 400 },
      );
    }

    if (!body.sellAmountPerCycle?.trim()) {
      return NextResponse.json(
        { error: "Enter the amount to buy on each cycle." },
        { status: 400 },
      );
    }

    const sellAmountPerCycle = Amount.parse(
      body.sellAmountPerCycle,
      sellToken.decimals,
      sellToken.symbol,
    );
    const starkzapSellToken = toStarkzapToken(sellToken);
    const starkzapBuyToken = toStarkzapToken(buyToken);

    if (intent === "preview") {
      const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });
      const preview = await flow.wallet.dca().previewCycle({
        buyToken: starkzapBuyToken,
        sellAmountPerCycle,
        sellToken: starkzapSellToken,
        slippageBps:
          body.slippageBps != null ? BigInt(body.slippageBps) : undefined,
      });

      return NextResponse.json({
        estimatedBuyPerCycle: Amount.fromRaw(
          preview.amountOutBase,
          buyToken.decimals,
          buyToken.symbol,
        ).toFormatted(),
        priceImpactBps: preview.priceImpactBps?.toString() ?? null,
        provider: preview.provider ?? "avnu",
      });
    }

    if (!body.sellAmount?.trim()) {
      return NextResponse.json(
        { error: "Enter the total DCA budget." },
        { status: 400 },
      );
    }

    const sellAmount = Amount.parse(
      body.sellAmount,
      sellToken.decimals,
      sellToken.symbol,
    );
    const frequency = resolveDcaFrequency(body.frequency);
    const flow = await initStarkFlow(user.id, userJwts, { deploy: "if_needed" });

    const tx = await flow.wallet.dca().create(
      {
        buyToken: starkzapBuyToken,
        frequency,
        pricingStrategy: {
          ...(body.minBuyAmount?.trim()
            ? {
                minBuyAmount: Amount.parse(
                  body.minBuyAmount,
                  buyToken.decimals,
                  buyToken.symbol,
                ),
              }
            : {}),
          ...(body.maxBuyAmount?.trim()
            ? {
                maxBuyAmount: Amount.parse(
                  body.maxBuyAmount,
                  buyToken.decimals,
                  buyToken.symbol,
                ),
              }
            : {}),
        },
        sellAmount,
        sellAmountPerCycle,
        sellToken: starkzapSellToken,
      },
      flow.deployed ? undefined : { feeMode: "sponsored" },
    );

    await tx.wait();
    const createdOrder = await pollForCreatedOrder(flow, tx.hash);

    if (createdOrder) {
      await prisma.dcaStrategy.upsert({
        where: { strategyId: createdOrder.id },
        update: {
          buyTokenSymbol: buyToken.symbol,
          frequency,
          orderAddress: createdOrder.orderAddress,
          providerId: createdOrder.providerId,
          sellAmount: sellAmount.toFormatted(),
          sellPerCycle: sellAmountPerCycle.toFormatted(),
          sellTokenSymbol: sellToken.symbol,
          status: createdOrder.status,
          txHash: createdOrder.creationTransactionHash ?? tx.hash,
        },
        create: {
          userId: user.id,
          buyTokenSymbol: buyToken.symbol,
          frequency,
          orderAddress: createdOrder.orderAddress,
          providerId: createdOrder.providerId,
          sellAmount: sellAmount.toFormatted(),
          sellPerCycle: sellAmountPerCycle.toFormatted(),
          sellTokenSymbol: sellToken.symbol,
          strategyId: createdOrder.id,
          status: createdOrder.status,
          txHash: createdOrder.creationTransactionHash ?? tx.hash,
        },
      });
    }

    return NextResponse.json({
      explorerUrl: tx.explorerUrl,
      frequency,
      provider: "avnu",
      sellAmount: sellAmount.toFormatted(),
      sellAmountPerCycle: sellAmountPerCycle.toFormatted(),
      strategyId: createdOrder?.id ?? null,
      strategyStatus: createdOrder?.status ?? "INDEXING",
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("[/api/move/dca][POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create DCA strategy.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
