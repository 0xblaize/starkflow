import { prisma } from "@/lib/prisma";
import type { PrivyClaims } from "@/lib/privy-server";

type PrivyAppUser = Awaited<ReturnType<typeof getOrCreatePrivyUser>>;

export async function getOrCreatePrivyUser(
  claimsOrPrivyUserId: PrivyClaims | string,
) {
  const privyUserId =
    typeof claimsOrPrivyUserId === "string"
      ? claimsOrPrivyUserId
      : claimsOrPrivyUserId.sub;

  const existingUser = await prisma.user.findUnique({
    where: { privyUserId },
  });

  if (existingUser) {
    return existingUser;
  }

  // Support users created before Privy IDs were stored in a dedicated column.
  const legacyUser = await prisma.user.findUnique({
    where: { id: privyUserId },
  });

  if (legacyUser) {
    if (!legacyUser.privyUserId) {
      return prisma.user.update({
        where: { id: legacyUser.id },
        data: { privyUserId },
      });
    }

    return legacyUser;
  }

  return prisma.user.create({
    data: {
      privyUserId,
      preferredNetwork: "sepolia",
      onboarded: false,
    },
  });
}

export async function getPrivyUserNetwork(
  claimsOrPrivyUserId: PrivyClaims | string,
) {
  const user = await getOrCreatePrivyUser(claimsOrPrivyUserId);
  return user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia";
}

export type { PrivyAppUser };
