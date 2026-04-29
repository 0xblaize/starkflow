import { RpcProvider } from "starknet";
import { Wallet } from "../../node_modules/starkzap/dist/src/wallet/index.js";
import { PrivySigner } from "../../node_modules/starkzap/dist/src/signer/index.js";
import { ArgentXV050Preset } from "../../node_modules/starkzap/dist/src/account/presets.js";
import { ChainId } from "../../node_modules/starkzap/dist/src/types/config.js";
import { mainnetTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.js";
import { sepoliaTokens } from "../../node_modules/starkzap/dist/src/erc20/token/presets.sepolia.js";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { getPrivyClient } from "@/lib/privy-client";
import { prisma } from "@/lib/prisma";

type WalletMetadata = {
  address: string;
  publicKey: string;
  walletId: string;
};

type SupportedNetwork = "sepolia" | "mainnet";

type InitStarkFlowOptions = {
  deploy?: "if_needed" | "never" | "always";
};

const avnuApiKey = process.env.AVNU_PAYMASTER_API_KEY;

const NETWORK_CONFIG: Record<
  SupportedNetwork,
  {
    rpcUrl: string;
    chainId: InstanceType<typeof ChainId>;
    explorerUrl: string;
  }
> = {
  sepolia: {
    rpcUrl:
      process.env.STARKNET_RPC_URL ??
      "https://starknet-sepolia.public.blastapi.io",
    chainId: ChainId.SEPOLIA,
    explorerUrl: "https://sepolia.voyager.online",
  },
  mainnet: {
    rpcUrl:
      process.env.STARKNET_MAINNET_RPC_URL ??
      "https://starknet-mainnet.public.blastapi.io",
    chainId: ChainId.MAINNET,
    explorerUrl: "https://voyager.online",
  },
};

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

async function connectPrivyStarknetWallet(
  network: SupportedNetwork,
  walletMetadata: WalletMetadata,
  userJwt: string,
  deploy: InitStarkFlowOptions["deploy"] = "if_needed",
) {
  const privy = getPrivyClient();
  const config = NETWORK_CONFIG[network];
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });

  const signer = new PrivySigner({
    walletId: walletMetadata.walletId,
    publicKey: walletMetadata.publicKey,
    rawSign: async (walletId, hash) => {
      const { signature } = await privy.wallets().rawSign(walletId, {
        authorization_context: {
          user_jwts: [userJwt],
        },
        params: { hash },
        request_expiry: privy.getRequestExpiry(),
      });

      return signature;
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
  userJwt: string,
  options: InitStarkFlowOptions = {},
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("App user not found");
  }

  const privyUserId = user.privyUserId ?? user.id;
  const network = normalizePreferredNetwork(
    user.preferredNetwork,
  ) as SupportedNetwork;
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
    userJwt,
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
