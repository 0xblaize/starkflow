import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { prisma } from "@/lib/prisma";

function normalizeUsername(input: string) {
  return input
    .trim()
    .replace(/^@/, "")
    .replace(/\.stark$/i, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const appUser = await getOrCreatePrivyUser(claims);

    return NextResponse.json({
      id: appUser.id,
      onboarded: appUser.onboarded,
      username: appUser.username,
      preferredNetwork:
        appUser.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
      starknetAddress: appUser.starknetAddress,
      handlePublic: appUser.handlePublic,
      image: appUser.image,
    });
  } catch (err) {
    console.error("[/api/profile][GET]", err);
    const message = err instanceof Error ? err.message : "Failed to fetch profile.";
    const status =
      message.includes("Missing Privy auth token") ||
      message.toLowerCase().includes("jwt")
        ? 401
        : 500;
    return NextResponse.json(
      {
        error: "Failed to fetch profile.",
        ...(process.env.NODE_ENV !== "production"
          ? { details: message }
          : {}),
      },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const appUser = await getOrCreatePrivyUser(claims);
    const userId = appUser.id;

    const body: {
      username?: string;
      preferredNetwork?: string;
      imageData?: string;
      skip?: boolean;
    } = await req.json();

    if (body.skip) {
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          privyUserId: claims.sub,
          preferredNetwork: "sepolia",
          onboarded: true,
        },
        update: { onboarded: true },
      });
      return NextResponse.json({ ok: true });
    }

    const usernameSource = body.username ?? appUser.username ?? "";
    const username = normalizeUsername(usernameSource);
    const preferredNetwork =
      body.preferredNetwork === "mainnet" ? "mainnet" : "sepolia";
    const imageData =
      typeof body.imageData === "string" ? body.imageData.trim() : undefined;

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (username.length > 24) {
      return NextResponse.json({ error: "Username must be under 24 characters." }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        privyUserId: claims.sub,
        username,
        preferredNetwork,
        ...(imageData !== undefined ? { image: imageData || null } : {}),
        onboarded: true,
      },
      update: {
        username,
        preferredNetwork,
        ...(imageData !== undefined ? { image: imageData || null } : {}),
        onboarded: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/profile]", err);
    const message = err instanceof Error ? err.message : "Failed to save profile.";
    const status =
      message.includes("Missing Privy auth token") ||
      message.toLowerCase().includes("jwt")
        ? 401
        : 500;
    return NextResponse.json(
      {
        error: "Failed to save profile.",
        ...(process.env.NODE_ENV !== "production"
          ? { details: message }
          : {}),
      },
      { status },
    );
  }
}
