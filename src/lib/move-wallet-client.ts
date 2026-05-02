"use client";

import { RpcProvider } from "starknet";
import type { Address } from "../../node_modules/starkzap/dist/src/types/address.js";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";

type MoveExecutionSession = {
  address: string;
  explorerUrl: string;
  network: "mainnet" | "sepolia";
  paymasterUrl: string | null;
  publicKey: string;
  rpcUrl: string;
  signUrl: string;
  sponsoredExecution: boolean;
  walletId: string;
};

type AuthorizationSignatureGenerator = (
  input:
    | Uint8Array
    | {
        body: unknown;
        headers: {
          "privy-app-id": string;
          "privy-idempotency-key"?: string;
          "privy-request-expiry"?: string;
        };
        method: "POST" | "PUT" | "PATCH" | "DELETE";
        timestamp?: number;
        url: string;
        version: 1;
      },
) => Promise<{ signature: string }>;

type StarkzapModules = {
  Amount: typeof import("../../node_modules/starkzap/dist/src/types/amount.js").Amount;
  ArgentXV050Preset: typeof import("../../node_modules/starkzap/dist/src/account/presets.js").ArgentXV050Preset;
  ChainId: typeof import("../../node_modules/starkzap/dist/src/types/config.js").ChainId;
  PrivySigner: typeof import("../../node_modules/starkzap/dist/src/signer/index.js").PrivySigner;
  Wallet: typeof import("../../node_modules/starkzap/dist/src/wallet/index.js").Wallet;
};

type MoveExecutionClient = {
  Amount: StarkzapModules["Amount"];
  session: MoveExecutionSession;
  wallet: Awaited<ReturnType<StarkzapModules["Wallet"]["create"]>>;
};

let starkzapModulesPromise: Promise<StarkzapModules> | null = null;

function getAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(value, window.location.origin).toString();
}

function toStarkzapAddress(value: string) {
  return value as Address;
}

async function getAccessTokenOrThrow(
  getAccessToken: () => Promise<string | null>,
) {
  const token = await waitForPrivyAccessToken(getAccessToken);

  if (!token) {
    throw new Error("Privy token not ready");
  }

  return token;
}

function decodeBase64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function loadStarkzapModules(): Promise<StarkzapModules> {
  if (!starkzapModulesPromise) {
    starkzapModulesPromise = Promise.all([
      import("../../node_modules/starkzap/dist/src/wallet/index.js"),
      import("../../node_modules/starkzap/dist/src/signer/index.js"),
      import("../../node_modules/starkzap/dist/src/account/presets.js"),
      import("../../node_modules/starkzap/dist/src/types/config.js"),
      import("../../node_modules/starkzap/dist/src/types/amount.js"),
    ]).then(([wallet, signer, presets, config, amount]) => ({
      Amount: amount.Amount,
      ArgentXV050Preset: presets.ArgentXV050Preset,
      ChainId: config.ChainId,
      PrivySigner: signer.PrivySigner,
      Wallet: wallet.Wallet,
    }));
  }

  return starkzapModulesPromise;
}

async function fetchMoveExecutionSession(options: {
  getAccessToken: () => Promise<string | null>;
  identityToken: string | null;
  preferredNetwork: "mainnet" | "sepolia";
}): Promise<MoveExecutionSession> {
  const accessToken = await getAccessTokenOrThrow(options.getAccessToken);
  const response = await fetch(
    `/api/move/session?network=${encodeURIComponent(options.preferredNetwork)}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.identityToken
          ? { "x-privy-identity-token": options.identityToken }
          : {}),
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | MoveExecutionSession
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? payload.error
        : `Failed to load wallet session (${response.status})`,
    );
  }

  return payload as MoveExecutionSession;
}

export async function getMoveExecutionClient(options: {
  generateAuthorizationSignature: AuthorizationSignatureGenerator;
  getAccessToken: () => Promise<string | null>;
  identityToken: string | null;
  preferredNetwork: "mainnet" | "sepolia";
}): Promise<MoveExecutionClient> {
  const [modules, session, accessToken] = await Promise.all([
    loadStarkzapModules(),
    fetchMoveExecutionSession(options),
    getAccessTokenOrThrow(options.getAccessToken),
  ]);

  const signer = new modules.PrivySigner({
    walletId: session.walletId,
    publicKey: session.publicKey,
    serverUrl: getAbsoluteUrl(session.signUrl),
    headers: async () => {
      const latestAccessToken = await getAccessTokenOrThrow(options.getAccessToken);

      return {
        Authorization: `Bearer ${latestAccessToken}`,
        ...(options.identityToken
          ? { "x-privy-identity-token": options.identityToken }
          : {}),
      };
    },
    buildBody: async ({ walletId, hash }) => {
      const latestAccessToken = await getAccessTokenOrThrow(options.getAccessToken);
      const payloadResponse = await fetch("/api/move/sign-payload", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${latestAccessToken}`,
          ...(options.identityToken
            ? { "x-privy-identity-token": options.identityToken }
            : {}),
        },
        body: JSON.stringify({
          hash,
          walletId,
        }),
      });
      const payloadBody = (await payloadResponse.json().catch(() => null)) as
        | {
            error?: string;
            payload?: string;
            privyRequestExpiry?: string;
          }
        | null;

      if (!payloadResponse.ok || !payloadBody?.payload || !payloadBody.privyRequestExpiry) {
        throw new Error(
          payloadBody?.error ??
            `Failed to prepare Privy authorization payload (${payloadResponse.status})`,
        );
      }

      const { signature } = await options.generateAuthorizationSignature(
        decodeBase64ToBytes(payloadBody.payload),
      );

      return {
        walletId,
        hash,
        privyAuthorizationSignature: signature,
        privyRequestExpiry: payloadBody.privyRequestExpiry,
      };
    },
    requestTimeoutMs: 20_000,
  });

  const wallet = await modules.Wallet.create({
    account: {
      signer,
      accountClass: modules.ArgentXV050Preset,
    },
    accountAddress: toStarkzapAddress(session.address),
    provider: new RpcProvider({ nodeUrl: session.rpcUrl }),
    config: {
      rpcUrl: session.rpcUrl,
      chainId:
        session.network === "mainnet"
          ? modules.ChainId.MAINNET
          : modules.ChainId.SEPOLIA,
      explorer: {
        baseUrl: session.explorerUrl,
      },
      ...(session.paymasterUrl
        ? {
            paymaster: {
              nodeUrl: getAbsoluteUrl(session.paymasterUrl),
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          }
        : {}),
    },
    feeMode: session.sponsoredExecution ? "sponsored" : "user_pays",
  });

  return {
    Amount: modules.Amount,
    session,
    wallet,
  };
}
