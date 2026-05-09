import { Account, CallData, RpcProvider, cairo, shortString } from "starknet";
import { getStarknetRpcUrl } from "@/lib/starknet-rpc";

export type PredictEscrowNetwork = "mainnet" | "sepolia";

type PredictEscrowMarketState = {
  noPoolRaw: bigint;
  resolved: boolean;
  resolveAt: bigint;
  settlementPriceRaw: bigint;
  winningSide: 0 | 1 | 2;
  yesPoolRaw: bigint;
};

type ResolverSession = {
  account: Account;
  provider: RpcProvider;
};

const resolverSessionCache = new Map<string, ResolverSession>();

function normalizeOptional(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeHex(value: string) {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function u256FromResponse(low: string, high: string) {
  return BigInt(low) + (BigInt(high) << BigInt(128));
}

function getTransactionHash(response: { transaction_hash?: string; transactionHash?: string }) {
  const txHash = response.transaction_hash ?? response.transactionHash;

  if (!txHash) {
    throw new Error("Escrow transaction hash missing from Starknet response.");
  }

  return normalizeHex(txHash);
}

function getResolverPrivateKey() {
  return normalizeOptional(process.env.PREDICT_ESCROW_RESOLVER_PRIVATE_KEY);
}

function getResolverAccountAddress() {
  return (
    normalizeOptional(process.env.PREDICT_ESCROW_RESOLVER_ACCOUNT_ADDRESS) ??
    normalizeOptional(process.env.PREDICT_ESCROW_RESOLVER_ADDRESS)
  );
}

export function isPredictEscrowAutomationConfigured() {
  return Boolean(getResolverPrivateKey() && getResolverAccountAddress());
}

function getResolverSession(network: PredictEscrowNetwork) {
  const accountAddress = getResolverAccountAddress();
  const privateKey = getResolverPrivateKey();

  if (!accountAddress || !privateKey) {
    throw new Error(
      "Prediction escrow automation is missing resolver account credentials.",
    );
  }

  const rpcUrl = getStarknetRpcUrl(network);
  const cacheKey = `${network}:${rpcUrl}:${accountAddress}`;
  const cached = resolverSessionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account({
    address: accountAddress,
    provider,
    signer: privateKey,
  });
  const session = { account, provider };
  resolverSessionCache.set(cacheKey, session);
  return session;
}

function encodeMarketId(onchainMarketId: string) {
  return shortString.encodeShortString(onchainMarketId);
}

function priceUsdToOnchainUint256(priceUsd: number) {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error(`Invalid settlement price ${priceUsd}.`);
  }

  const scaled = BigInt(Math.round(priceUsd * 100_000_000));
  return cairo.uint256(scaled);
}

export function normalizePredictEscrowError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  const message = raw.toUpperCase();

  if (message.includes("MARKET_DONE")) {
    return "MARKET_DONE";
  }

  if (message.includes("NO_WINNING_BET")) {
    return "NO_WINNING_BET";
  }

  if (message.includes("ALREADY_CLAIMED")) {
    return "ALREADY_CLAIMED";
  }

  if (message.includes("NOT_RESOLVED")) {
    return "NOT_RESOLVED";
  }

  if (message.includes("TOO_EARLY")) {
    return "TOO_EARLY";
  }

  return raw;
}

export async function getPredictEscrowMarketState(params: {
  escrowAddress: string;
  network: PredictEscrowNetwork;
  onchainMarketId: string;
}): Promise<PredictEscrowMarketState> {
  const { provider } = getResolverSession(params.network);
  const response = await provider.callContract({
    contractAddress: params.escrowAddress,
    entrypoint: "get_market",
    calldata: [encodeMarketId(params.onchainMarketId)],
  });

  if (!Array.isArray(response) || response.length < 20) {
    throw new Error("Unexpected get_market response from prediction escrow.");
  }

  return {
    noPoolRaw: u256FromResponse(response[14], response[15]),
    resolved: BigInt(response[16]) !== BigInt(0),
    resolveAt: BigInt(response[11]),
    settlementPriceRaw: u256FromResponse(response[18], response[19]),
    winningSide: Number(response[17]) as 0 | 1 | 2,
    yesPoolRaw: u256FromResponse(response[12], response[13]),
  };
}

export async function resolvePredictEscrowMarket(params: {
  escrowAddress: string;
  finalPriceUsd: number;
  network: PredictEscrowNetwork;
  onchainMarketId: string;
}) {
  const { account, provider } = getResolverSession(params.network);
  const tx = await account.execute({
    contractAddress: params.escrowAddress,
    entrypoint: "resolve_market",
    calldata: CallData.compile({
      final_price: priceUsdToOnchainUint256(params.finalPriceUsd),
      market_id: encodeMarketId(params.onchainMarketId),
    }),
  });
  const txHash = getTransactionHash(tx);
  await provider.waitForTransaction(txHash);
  return txHash;
}

export async function claimPredictEscrowWinningsFor(params: {
  escrowAddress: string;
  network: PredictEscrowNetwork;
  onchainMarketId: string;
  userAddress: string;
}) {
  const { account, provider } = getResolverSession(params.network);
  const tx = await account.execute({
    contractAddress: params.escrowAddress,
    entrypoint: "claim_for",
    calldata: CallData.compile({
      market_id: encodeMarketId(params.onchainMarketId),
      user: params.userAddress,
    }),
  });
  const txHash = getTransactionHash(tx);
  await provider.waitForTransaction(txHash);
  return txHash;
}
