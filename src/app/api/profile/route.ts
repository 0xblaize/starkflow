import { NextRequest, NextResponse } from "next/server";
import { getPrivyErrorStatus, verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/promise-timeout";

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
    const appUser = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );

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
    return NextResponse.json(
      {
        error: "Failed to fetch profile.",
        ...(process.env.NODE_ENV !== "production"
          ? { details: message }
          : {}),
      },
      { status: getPrivyErrorStatus(err) },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const appUser = await withTimeout(
      getOrCreatePrivyUser(claims),
      6_000,
      "Profile lookup timed out.",
    );
    const userId = appUser.id;

    const body: {
      username?: string;
      preferredNetwork?: string;
      imageData?: string;
      skip?: boolean;
    } = await req.json();

    if (body.skip) {
      await withTimeout(
        prisma.user.upsert({
          where: { id: userId },
          create: {
            id: userId,
            privyUserId: claims.sub,
            preferredNetwork: "sepolia",
            onboarded: true,
          },
          update: { onboarded: true },
        }),
        6_000,
        "Profile save timed out.",
      );
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

    const taken = await withTimeout(
      prisma.user.findUnique({
        where: { username },
        select: { id: true },
      }),
      6_000,
      "Username check timed out.",
    );
    if (taken) {
      if (taken.id !== userId) {
        return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
      }
    }

    await withTimeout(
      prisma.user.upsert({
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
      }),
      6_000,
      "Profile save timed out.",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/profile]", err);
    const message = err instanceof Error ? err.message : "Failed to save profile.";
    return NextResponse.json(
      {
        error: "Failed to save profile.",
        ...(process.env.NODE_ENV !== "production"
          ? { details: message }
          : {}),
      },
      { status: getPrivyErrorStatus(err) },
    );
  }
}
