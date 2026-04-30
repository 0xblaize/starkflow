import { prisma } from "@/lib/prisma";

function looksLikeAddress(value: string) {
  return /^0x[0-9a-f]+$/i.test(value.trim());
}

export function normalizeStarknetAddress(value: string) {
  try {
    return `0x${BigInt(value.trim()).toString(16)}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

export function shortAddress(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function sanitizeRecipientQuery(value: string) {
  return value.trim();
}

export async function resolveMoveRecipient(query: string) {
  const sanitized = sanitizeRecipientQuery(query);

  if (!sanitized) {
    throw new Error("Enter a username or wallet address");
  }

  const handle = sanitized.replace(/^@/, "").replace(/\.stark$/i, "");

  let user = await prisma.user.findFirst({
    where: {
      username: {
        equals: handle,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      image: true,
      starknetAddress: true,
      username: true,
    },
  });

  const normalizedAddress = looksLikeAddress(sanitized)
    ? normalizeStarknetAddress(sanitized)
    : null;

  if (!user && normalizedAddress) {
    user = await prisma.user.findFirst({
      where: {
        starknetAddress: {
          equals: normalizedAddress,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        image: true,
        starknetAddress: true,
        username: true,
      },
    });
  }

  if (user?.starknetAddress) {
    return {
      address: normalizeStarknetAddress(user.starknetAddress),
      image: user.image,
      isInternal: true,
      userId: user.id,
      username: user.username,
    };
  }

  if (normalizedAddress) {
    return {
      address: normalizedAddress,
      image: null,
      isInternal: false,
      userId: null,
      username: null,
    };
  }

  throw new Error("Recipient not found");
}
