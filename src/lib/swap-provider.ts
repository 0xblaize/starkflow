import type { SwapInput, SwapQuote } from "../../node_modules/starkzap/dist/src/swap/interface.js";

export type SwapProviderMode = "AUTO" | "STARKZAP_AVNU" | "FALLBACK_EKUBO";
export type SwapProviderId = "avnu" | "ekubo";

type SwapWallet<TTx = unknown> = {
  getQuote(request: SwapInput): Promise<SwapQuote>;
  swap(request: SwapInput, options?: unknown): Promise<TTx>;
};

type SwapProviderStep = {
  fallbackTriggered: boolean;
  providerUsed: SwapProviderId;
};

export type SwapQuoteWithProvider = SwapProviderStep & {
  providerMode: SwapProviderMode;
  quote: SwapQuote;
};

export type SwapExecutionWithProvider<TTx = unknown> = SwapProviderStep & {
  providerMode: SwapProviderMode;
  tx: TTx;
};

export const SWAP_PROVIDER_OPTIONS: Array<{
  description: string;
  label: string;
  value: SwapProviderMode;
}> = [
  {
    value: "AUTO",
    label: "Auto",
    description: "Try StarkZap / AVNU first, then Ekubo if AVNU has no route.",
  },
  {
    value: "STARKZAP_AVNU",
    label: "StarkZap / AVNU",
    description: "Use the primary StarkZap AVNU router only.",
  },
  {
    value: "FALLBACK_EKUBO",
    label: "Ekubo",
    description: "Use the Ekubo route directly.",
  },
];

const NO_ROUTE_PATTERN = /AVNU quote returned no routes|NO_ROUTE|no routes|no route/i;
const LIQUIDITY_PATTERN = /insufficient liquidity/i;

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Swap request failed.");
}

function withProvider(request: SwapInput, provider: SwapProviderId): SwapInput {
  return {
    ...request,
    provider,
  };
}

function buildAutoFallbackMessage(
  primaryError: unknown,
  fallbackError: unknown,
) {
  const normalizedFallback = toError(fallbackError);

  if (isNoRouteSwapError(normalizedFallback)) {
    return new Error(
      "No swap route was found on StarkZap / AVNU or Ekubo for this pair and amount. Try a different amount or token pair.",
    );
  }

  if (isLiquiditySwapError(normalizedFallback)) {
    return new Error(
      "This pair does not have enough liquidity right now. Try a smaller amount or another token pair.",
    );
  }

  return new Error("Swap routing failed on both providers. Try again or switch the provider mode.");
}

export function isNoRouteSwapError(error: unknown) {
  return NO_ROUTE_PATTERN.test(toError(error).message);
}

export function isLiquiditySwapError(error: unknown) {
  return LIQUIDITY_PATTERN.test(toError(error).message);
}

export function getSwapProviderLabel(
  provider: SwapProviderMode | SwapProviderId | null | undefined,
) {
  if (provider === "AUTO") return "Auto";
  if (provider === "STARKZAP_AVNU" || provider === "avnu") return "StarkZap / AVNU";
  if (provider === "FALLBACK_EKUBO" || provider === "ekubo") return "Ekubo";
  return "Unknown";
}

export function formatSwapModeError(
  error: unknown,
  providerMode: SwapProviderMode,
) {
  const normalized = toError(error);

  if (providerMode === "AUTO") {
    if (isLiquiditySwapError(normalized)) {
      return "This pair does not have enough liquidity right now. Try a smaller amount or another token pair.";
    }
    return normalized.message;
  }

  if (providerMode === "STARKZAP_AVNU" && isNoRouteSwapError(normalized)) {
    return "StarkZap / AVNU returned no route for this pair and amount. Switch to Auto to try Ekubo fallback, or change the amount or pair.";
  }

  if (providerMode === "STARKZAP_AVNU" && isLiquiditySwapError(normalized)) {
    return "This pair does not have enough liquidity on StarkZap / AVNU right now. Try a smaller amount, another pair, or switch to Auto.";
  }

  if (providerMode === "FALLBACK_EKUBO" && isNoRouteSwapError(normalized)) {
    return "Ekubo returned no route for this pair and amount. Switch to Auto or StarkZap / AVNU, or change the amount or pair.";
  }

  if (providerMode === "FALLBACK_EKUBO" && isLiquiditySwapError(normalized)) {
    return "This pair does not have enough liquidity on Ekubo right now. Try a smaller amount, another pair, or switch providers.";
  }

  return normalized.message;
}

export async function getSwapQuoteForMode(
  wallet: SwapWallet,
  request: SwapInput,
  providerMode: SwapProviderMode,
): Promise<SwapQuoteWithProvider> {
  if (providerMode === "STARKZAP_AVNU") {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "avnu",
      quote: await wallet.getQuote(withProvider(request, "avnu")),
    };
  }

  if (providerMode === "FALLBACK_EKUBO") {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "ekubo",
      quote: await wallet.getQuote(withProvider(request, "ekubo")),
    };
  }

  try {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "avnu",
      quote: await wallet.getQuote(withProvider(request, "avnu")),
    };
  } catch (primaryError) {
    if (!isNoRouteSwapError(primaryError)) {
      throw primaryError;
    }

    try {
      return {
        fallbackTriggered: true,
        providerMode,
        providerUsed: "ekubo",
        quote: await wallet.getQuote(withProvider(request, "ekubo")),
      };
    } catch (fallbackError) {
      throw buildAutoFallbackMessage(primaryError, fallbackError);
    }
  }
}

export async function executeSwapForMode<TTx>(
  wallet: SwapWallet<TTx>,
  request: SwapInput,
  providerMode: SwapProviderMode,
  options?: unknown,
): Promise<SwapExecutionWithProvider<TTx>> {
  if (providerMode === "STARKZAP_AVNU") {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "avnu",
      tx: await wallet.swap(withProvider(request, "avnu"), options),
    };
  }

  if (providerMode === "FALLBACK_EKUBO") {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "ekubo",
      tx: await wallet.swap(withProvider(request, "ekubo"), options),
    };
  }

  try {
    return {
      fallbackTriggered: false,
      providerMode,
      providerUsed: "avnu",
      tx: await wallet.swap(withProvider(request, "avnu"), options),
    };
  } catch (primaryError) {
    if (!isNoRouteSwapError(primaryError)) {
      throw primaryError;
    }

    try {
      return {
        fallbackTriggered: true,
        providerMode,
        providerUsed: "ekubo",
        tx: await wallet.swap(withProvider(request, "ekubo"), options),
      };
    } catch (fallbackError) {
      throw buildAutoFallbackMessage(primaryError, fallbackError);
    }
  }
}
