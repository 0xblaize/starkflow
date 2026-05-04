export type PredictEscrowRule = "ABOVE" | "BELOW";
export type PredictEscrowSide = "YES" | "NO";

export type PredictEscrowConfig = {
  address: string;
  collateralTokenAddress: string;
  resolverAddress: string | null;
};

function normalizeOptionalAddress(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getPredictEscrowConfig(): PredictEscrowConfig | null {
  const address = normalizeOptionalAddress(
    process.env.NEXT_PUBLIC_PREDICT_ESCROW_ADDRESS,
  );
  const collateralTokenAddress = normalizeOptionalAddress(
    process.env.NEXT_PUBLIC_PREDICT_COLLATERAL_TOKEN_ADDRESS,
  );

  if (!address || !collateralTokenAddress) {
    return null;
  }

  return {
    address,
    collateralTokenAddress,
    resolverAddress: normalizeOptionalAddress(
      process.env.PREDICT_ESCROW_RESOLVER_ADDRESS,
    ),
  };
}

export function isPredictEscrowConfigured() {
  return getPredictEscrowConfig() != null;
}
