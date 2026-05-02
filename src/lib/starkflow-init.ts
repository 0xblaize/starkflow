import { RpcProvider } from "starknet";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { getPrivyClient } from "@/lib/privy-client";
import { prisma } from "@/lib/prisma";

type WalletMetadata = {
  address: string;
  publicKey: string;
  walletId: string;
};

type SupportedNetwork = "sepolia" | "mainnet";

export type PrivyStarknetWalletSession = {
  address: string;
  explorerUrl: string;
  network: SupportedNetwork;
  paymasterUrl: string | null;
  publicKey: string;
  rpcUrl: string;
  signUrl: string;
  sponsoredExecution: boolean;
  walletId: string;
};

type InitStarkFlowOptions = {
  deploy?: "if_needed" | "never" | "always";
};

const avnuApiKey = process.env.AVNU_PAYMASTER_API_KEY;

type JwtDebugSummary = {
  aud: string | string[] | null;
  exp: number | null;
  iss: string | null;
  kind: "access" | "identity" | "unknown";
  sub: string | null;
};

function decodeJwtSummary(token: string): JwtDebugSummary {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) {
      return {
        aud: null,
        exp: null,
        iss: null,
        kind: "unknown",
        sub: null,
      };
    }

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;

    return {
      aud:
        typeof payload.aud === "string" || Array.isArray(payload.aud)
          ? (payload.aud as string | string[])
          : null,
      exp: typeof payload.exp === "number" ? payload.exp : null,
      iss: typeof payload.iss === "string" ? payload.iss : null,
      kind:
        Array.isArray(payload.linked_accounts)
          ? "identity"
          : typeof payload.sid === "string"
            ? "access"
            : "unknown",
      sub: typeof payload.sub === "string" ? payload.sub : null,
    };
  } catch {
    return {
      aud: null,
      exp: null,
      iss: null,
      kind: "unknown",
      sub: null,
    };
  }
}

// Lazy load starkzap to avoid bundling it at build time
let cachedStarkzap: any = null;

async function getStarkzap() {
  if (!cachedStarkzap) {
    const [wallet, signer, presets, config, tokens, tokensSepolia] = await Promise.all([
      import("../../node_modules/starkzap/dist/src/wallet/index.js"),
      import("../../node_modules/starkzap/dist/src/signer/index.js"),
      import("../../node_modules/starkzap/dist/src/account/presets.js"),
      import("../../node_modules/starkzap/dist/src/types/config.js"),
      import("../../node_modules/starkzap/dist/src/erc20/token/presets.js"),
      import("../../node_modules/starkzap/dist/src/erc20/token/presets.sepolia.js"),
    ]);

    cachedStarkzap = {
      Wallet: wallet.Wallet,
      PrivySigner: signer.PrivySigner,
      ArgentXV050Preset: presets.ArgentXV050Preset,
      ChainId: config.ChainId,
      mainnetTokens: tokens.mainnetTokens,
      sepoliaTokens: tokensSepolia.sepoliaTokens,
    };
  }
  return cachedStarkzap;
}

const NETWORK_CONFIG = async () => {
  const { ChainId } = await getStarkzap();

  return {
    sepolia: {
      rpcUrl:
        process.env.STARKNET_RPC_URL ??
        "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
      chainId: ChainId.SEPOLIA,
      explorerUrl: "https://sepolia.voyager.online",
    },
    mainnet: {
      rpcUrl:
        process.env.STARKNET_MAINNET_RPC_URL ??
        "https://free-rpc.nethermind.io/mainnet-juno/v0_7",
      chainId: ChainId.MAINNET,
      explorerUrl: "https://voyager.online",
    },
  } as const;
};

async function resolveNetworkConfig(preferredNetwork?: string | null) {
  const network = normalizePreferredNetwork(
    preferredNetwork,
  ) as SupportedNetwork;
  const config = (await NETWORK_CONFIG())[network];

  return { config, network };
}

function buildPaymaster(network: SupportedNetwork) {
  if (!avnuApiKey) return {};

  return {
    paymaster: {
      nodeUrl:
        network === "mainnet"
          ? "https://starknet.paymaster.avnu.fi"
          : "https://sepolia.paymaster.avnu.fi",
      headers: { "x-paymaster-api-key": avnuApiKey },
    },
  };
}

function extractPrivyStarknetWallet(privyUser: {
  linked_accounts: unknown[];
}): WalletMetadata | null {
  const wallet = privyUser.linked_accounts.find((account) => {
    if (!account || typeof account !== "object") return false;

    const candidate = account as Record<string, unknown>;

    return (
      candidate.type === "wallet" &&
      candidate.wallet_client === "privy" &&
      candidate.chain_type === "starknet" &&
      typeof candidate.id === "string" &&
      typeof candidate.address === "string" &&
      typeof candidate.public_key === "string"
    );
  });

  if (!wallet) return null;

  const candidate = wallet as Record<string, string>;

  return {
    address: candidate.address,
    publicKey: candidate.public_key,
    walletId: candidate.id,
  };
}

async function ensurePrivyStarknetWallet(privyUserId: string) {
  const privy = getPrivyClient();

  let privyUser = await privy.users()._get(privyUserId);
  let wallet = extractPrivyStarknetWallet(privyUser);

  if (!wallet) {
    await privy.users().pregenerateWallets(privyUserId, {
      wallets: [{ chain_type: "starknet" }],
    });
    privyUser = await privy.users()._get(privyUserId);
    wallet = extractPrivyStarknetWallet(privyUser);
  }

  if (!wallet) {
    throw new Error("Privy Starknet wallet could not be created for this user");
  }

  return wallet;
}

export async function getPrivyStarknetWalletSession(
  privyUserId: string,
  preferredNetwork?: string | null,
): Promise<PrivyStarknetWalletSession> {
  const [{ config, network }, walletMetadata] = await Promise.all([
    resolveNetworkConfig(preferredNetwork),
    ensurePrivyStarknetWallet(privyUserId),
  ]);

  return {
    address: walletMetadata.address,
    explorerUrl: config.explorerUrl,
    network,
    paymasterUrl: avnuApiKey
      ? `/api/move/paymaster?network=${network}`
      : null,
    publicKey: walletMetadata.publicKey,
    rpcUrl: config.rpcUrl,
    signUrl: "/api/move/sign",
    sponsoredExecution: Boolean(avnuApiKey),
    walletId: walletMetadata.walletId,
  };
}

async function connectPrivyStarknetWallet(
  network: SupportedNetwork,
  walletMetadata: WalletMetadata,
  userJwts: string[],
  deploy: InitStarkFlowOptions["deploy"] = "if_needed",
) {
  const { Wallet, PrivySigner, ArgentXV050Preset, ChainId } = await getStarkzap();
  const privy = getPrivyClient();
  const { config } = await resolveNetworkConfig(network);
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });

  const signer = new PrivySigner({
    walletId: walletMetadata.walletId,
    publicKey: walletMetadata.publicKey,
    rawSign: async (walletId: string, hash: string) => {
      let lastError: unknown;
      const attempts: string[] = [];

      for (const userJwt of userJwts) {
        const jwtSummary = decodeJwtSummary(userJwt);

        try {
          const { signature } = await privy.wallets().rawSign(walletId, {
            authorization_context: {
              user_jwts: [userJwt],
            },
            params: { hash },
          });

          return signature;
        } catch (error) {
          lastError = error;
          const message =
            error instanceof Error ? error.message.toLowerCase() : "";
          attempts.push(
            `${jwtSummary.kind}(iss=${jwtSummary.iss ?? "?"}, aud=${
              Array.isArray(jwtSummary.aud)
                ? jwtSummary.aud.join(",")
                : (jwtSummary.aud ?? "?")
            }, sub=${jwtSummary.sub ?? "?"}, exp=${jwtSummary.exp ?? "?"}) => ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );

          if (
            !message.includes("invalid jwt") &&
            !message.includes("invalid_data")
          ) {
            throw error;
          }
        }
      }

      const attemptSummary =
        attempts.length > 0 ? ` Attempts: ${attempts.join(" | ")}` : "";

      throw lastError instanceof Error
        ? new Error(`${lastError.message}${attemptSummary}`)
        : new Error(`Privy rawSign failed for all available JWTs.${attemptSummary}`);
    },
  });

  const wallet = await Wallet.create({
    account: {
      signer,
      accountClass: ArgentXV050Preset,
    },
    provider,
    config: {
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      explorer: {
        baseUrl: config.explorerUrl,
      },
      ...buildPaymaster(network),
    },
    feeMode: avnuApiKey ? "sponsored" : "user_pays",
  });

  if (deploy !== "never") {
    await wallet.ensureReady({
      deploy,
      ...(avnuApiKey ? { feeMode: "sponsored" as const } : {}),
    });
  }

  const deployed = await wallet.isDeployed();

  return { wallet, deployed };
}

export async function initStarkFlow(
  userId: string,
  userJwt: string | string[],
  options: InitStarkFlowOptions = {},
) {
  const { mainnetTokens, sepoliaTokens } = await getStarkzap();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("App user not found");
  }

  const privyUserId = user.privyUserId ?? user.id;
  const walletAuthorizationJwts = Array.isArray(userJwt) ? userJwt : [userJwt];
  const { network } = await resolveNetworkConfig(user.preferredNetwork);
  const walletMetadata = await ensurePrivyStarknetWallet(privyUserId);

  const needsMetadataSync =
    user.privyUserId !== privyUserId ||
    user.privyWalletId !== walletMetadata.walletId ||
    user.privyWalletPublicKey !== walletMetadata.publicKey ||
    user.starknetAddress !== walletMetadata.address;

  const syncedUser = needsMetadataSync
    ? await prisma.user.update({
        where: { id: user.id },
        data: {
          privyUserId,
          privyWalletId: walletMetadata.walletId,
          privyWalletPublicKey: walletMetadata.publicKey,
          starknetAddress: walletMetadata.address,
        },
      })
    : user;

  const { wallet, deployed } = await connectPrivyStarknetWallet(
    network,
    walletMetadata,
    walletAuthorizationJwts,
    options.deploy ?? "if_needed",
  );

  const resolvedAddress = wallet.address.toString();

  if (syncedUser.starknetAddress !== resolvedAddress) {
    await prisma.user.update({
      where: { id: syncedUser.id },
      data: { starknetAddress: resolvedAddress },
    });
  }

  return {
    address: resolvedAddress,
    deployed,
    network,
    tokens: network === "mainnet" ? mainnetTokens : sepoliaTokens,
    user: syncedUser,
    wallet,
  };
}
