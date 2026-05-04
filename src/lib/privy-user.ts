import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runPrismaWithRecovery } from "@/lib/prisma";
import type { PrivyClaims } from "@/lib/privy-server";

type PrivyAppUser = Awaited<ReturnType<typeof getOrCreatePrivyUser>>;
const pendingPrivyUsers = new Map<string, Promise<User>>();
const PRIVY_USER_TIMEOUT_MS = 2_500;

async function loadOrCreatePrivyUser(privyUserId: string) {
  const existingUser =
    (await runPrismaWithRecovery(
      () =>
        prisma.user.findUnique({
          where: { privyUserId },
        }),
      {
        timeoutMs: PRIVY_USER_TIMEOUT_MS,
        timeoutLabel: "Privy user lookup timed out.",
      },
    )) ??
    (await runPrismaWithRecovery(
      () =>
        prisma.user.findUnique({
          where: { id: privyUserId },
        }),
      {
        timeoutMs: PRIVY_USER_TIMEOUT_MS,
        timeoutLabel: "Privy user lookup timed out.",
      },
    ));

  if (existingUser) {
    if (!existingUser.privyUserId) {
      return runPrismaWithRecovery(
        () =>
          prisma.user.update({
            where: { id: existingUser.id },
            data: { privyUserId },
          }),
        {
          timeoutMs: PRIVY_USER_TIMEOUT_MS,
          timeoutLabel: "Privy user update timed out.",
        },
      );
    }

    return existingUser;
  }

  try {
    return await runPrismaWithRecovery(
      () =>
        prisma.user.create({
          data: {
            privyUserId,
            preferredNetwork: "sepolia",
            onboarded: false,
          },
        }),
      {
        timeoutMs: PRIVY_USER_TIMEOUT_MS,
        timeoutLabel: "Privy user creation timed out.",
      },
    );
  } catch (error) {
    // Parallel first-load requests can race on the unique privyUserId.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const createdUser = await runPrismaWithRecovery(
        () =>
          prisma.user.findUnique({
            where: { privyUserId },
          }),
        {
          timeoutMs: PRIVY_USER_TIMEOUT_MS,
          timeoutLabel: "Privy user lookup timed out.",
        },
      );

      if (createdUser) {
        return createdUser;
      }
    }

    throw error;
  }
}

export async function getOrCreatePrivyUser(
  claimsOrPrivyUserId: PrivyClaims | string,
) {
  const privyUserId =
    typeof claimsOrPrivyUserId === "string"
      ? claimsOrPrivyUserId
      : claimsOrPrivyUserId.sub;

  const pending = pendingPrivyUsers.get(privyUserId);
  if (pending) {
    return pending;
  }

  const request = loadOrCreatePrivyUser(privyUserId).finally(() => {
    pendingPrivyUsers.delete(privyUserId);
  });

  pendingPrivyUsers.set(privyUserId, request);
  return request;
}

export async function getPrivyUserNetwork(
  claimsOrPrivyUserId: PrivyClaims | string,
) {
  const user = await getOrCreatePrivyUser(claimsOrPrivyUserId);
  return user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia";
}

export type { PrivyAppUser };
