import { NextRequest, NextResponse } from "next/server";
import { getPrivyErrorStatus, getPrivyWalletJwts, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { findMoveTokenByAddress } from "@/lib/move-tokens";
import { initStarkFlow } from "@/lib/starkflow-init";
import { Amount } from "../../../../../node_modules/starkzap/dist/src/types/amount.js";
import type {
  LendingMarket,
  LendingUserPosition,
} from "../../../../../node_modules/starkzap/dist/src/lending/interface.js";
import type { Token } from "../../../../../node_modules/starkzap/dist/src/types/token.js";

function toTokenSummary(token: Token) {
  return {
    address: token.address,
    decimals: token.decimals,
    name: token.name,
    symbol: token.symbol,
  };
}

function formatRawAmount(rawValue: bigint, decimals: number, symbol: string) {
  return Amount.fromRaw(rawValue, decimals, symbol)
    .toFormatted(true)
    .replace(/\s+/g, " ");
}

function mapMarket(market: LendingMarket) {
  return {
    asset: toTokenSummary(market.asset),
    borrowApr: market.stats?.borrowApr?.toFormatted(true) ?? null,
    canBeBorrowed: market.canBeBorrowed ?? false,
    poolAddress: market.poolAddress,
    poolName: market.poolName ?? market.asset.symbol,
    protocol: market.protocol,
    supplyApy: market.stats?.supplyApy?.toFormatted(true) ?? null,
    totalBorrowed: market.stats?.totalBorrowed?.toFormatted(true) ?? null,
    totalSupplied: market.stats?.totalSupplied?.toFormatted(true) ?? null,
    utilization: market.stats?.utilization?.toFormatted(true) ?? null,
    vTokenAddress: market.vTokenAddress,
    vTokenSymbol: market.vTokenSymbol ?? null,
  };
}

function mapPosition(position: LendingUserPosition) {
  return {
    collateral: {
      ...toTokenSummary(position.collateral.token),
      amount: formatRawAmount(
        position.collateral.amount,
        position.collateral.token.decimals,
        position.collateral.token.symbol,
      ),
      usdValue:
        position.collateral.usdValue != null
          ? formatRawAmount(position.collateral.usdValue, 18, "USD")
          : null,
    },
    debt:
      position.debt != null
        ? {
            ...toTokenSummary(position.debt.token),
            amount: formatRawAmount(
              position.debt.amount,
              position.debt.token.decimals,
              position.debt.token.symbol,
            ),
            usdValue:
              position.debt.usdValue != null
                ? formatRawAmount(position.debt.usdValue, 18, "USD")
                : null,
          }
        : null,
    pool: position.pool,
    type: position.type,
  };
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwts = getPrivyWalletJwts(req);
    const user = await getOrCreatePrivyUser(claims);
    const flow = await initStarkFlow(user.id, userJwts, { deploy: "never" });

    const [markets, positions] = await Promise.all([
      flow.wallet.lending().getMarkets(),
      flow.wallet
        .lending()
        .getPositions()
        .catch(() => [] as LendingUserPosition[]),
    ]);

    const filteredMarkets = markets
      .filter((market: LendingMarket) =>
        ["STRK", "USDC", "USDC.e", "ETH", "WBTC"].includes(market.asset.symbol),
      )
      .slice(0, 10)
      .map(mapMarket);

    return NextResponse.json({
      markets: filteredMarkets,
      network: flow.network,
      positions: positions.map(mapPosition),
      provider: "vesu",
    });
  } catch (error) {
    console.error("[/api/move/yield][GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load yield markets.",
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
      amount?: string;
      tokenAddress?: string;
    };

    if (!body.tokenAddress?.trim()) {
      return NextResponse.json(
        { error: "Choose a token to deposit into yield." },
        { status: 400 },
      );
    }

    if (!body.amount?.trim()) {
      return NextResponse.json(
        { error: "Enter an amount to deposit." },
        { status: 400 },
      );
    }

    const token = findMoveTokenByAddress(user.preferredNetwork, body.tokenAddress);

    if (!token) {
      return NextResponse.json(
        { error: "Unsupported yield token." },
        { status: 400 },
      );
    }

    const flow = await initStarkFlow(user.id, userJwts, { deploy: "if_needed" });
    const markets = await flow.wallet.lending().getMarkets();
    const market = markets.find(
      (entry: LendingMarket) =>
        entry.asset.address.toLowerCase() === token.address.toLowerCase(),
    );

    if (!market) {
      return NextResponse.json(
        { error: "No live Vesu market found for that token on this network." },
        { status: 400 },
      );
    }

    const amount = Amount.parse(body.amount, token.decimals, token.symbol);
    const tx = await flow.wallet.lending().deposit(
      {
        amount,
        poolAddress: market.poolAddress,
        token: market.asset,
      },
      flow.deployed ? undefined : { feeMode: "sponsored" },
    );

    return NextResponse.json({
      amount: amount.toFormatted(),
      explorerUrl: tx.explorerUrl,
      poolName: market.poolName ?? market.asset.symbol,
      provider: "vesu",
      token: toTokenSummary(market.asset),
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("[/api/move/yield][POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open the yield deposit.",
      },
      { status: getPrivyErrorStatus(error) },
    );
  }
}
