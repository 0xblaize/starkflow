import { prisma } from "@/lib/prisma";

export type PreferredNetwork = "mainnet" | "sepolia";

export async function getAppUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export function fallbackUsernameFromId(userId: string) {
  return `stark-${userId.slice(-6).toLowerCase()}`;
}

export function normalizePreferredNetwork(
  preferredNetwork?: string | null,
): PreferredNetwork {
  return preferredNetwork === "mainnet" ? "mainnet" : "sepolia";
}

export function getPreferredNetworkLabel(
  preferredNetwork?: string | null,
) {
  return normalizePreferredNetwork(preferredNetwork) === "mainnet"
    ? "Mainnet"
    : "Sepolia";
}
