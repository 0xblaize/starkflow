import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const PRIVY_APP_ID =
  process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const DEFAULT_PRIVY_JWKS_URL =
  "https://auth.privy.io/api/v1/apps/cmofqhbgy00k30bl1rbozo3yd/jwks.json";
const PRIVY_JWKS_URL =
  process.env.PRIVY_JWKS_URL ??
  (PRIVY_APP_ID
    ? `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`
    : DEFAULT_PRIVY_JWKS_URL);

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(PRIVY_JWKS_URL));
  }
  return _jwks;
}

export type PrivyClaims = {
  /** Privy user DID, e.g. "did:privy:clxxxxxxx" */
  sub: string;
  /** App ID audience claim */
  aud: string | string[];
  sid: string;
};

export function getPrivyBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Missing Privy auth token");
  }

  return token;
}

export function getPrivyWalletJwt(req: NextRequest): string {
  try {
    return getPrivyBearerToken(req);
  } catch {
    const identityToken = req.headers.get("x-privy-identity-token")?.trim();

    if (identityToken) {
      return identityToken;
    }

    throw new Error("Missing Privy auth token");
  }
}

export function getPrivyWalletJwts(req: NextRequest): string[] {
  const tokens = new Set<string>();

  try {
    tokens.add(getPrivyBearerToken(req));
  } catch {
    // Ignore and rely on the identity token fallback.
  }

  const identityToken = req.headers.get("x-privy-identity-token")?.trim();
  if (identityToken) {
    tokens.add(identityToken);
  }

  if (tokens.size === 0) {
    throw new Error("Missing Privy auth token");
  }

  return [...tokens];
}

/**
 * Extracts and verifies the Privy JWT from the Authorization header.
 * Returns the decoded claims or throws if the token is invalid/missing.
 */
export async function verifyPrivyToken(req: NextRequest): Promise<PrivyClaims> {
  const token = getPrivyBearerToken(req);

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: "privy.io",
    audience: PRIVY_APP_ID,
  });

  return payload as unknown as PrivyClaims;
}

/**
 * Returns the Privy user DID from the Authorization header, or null on failure.
 * Use this for optional auth checks.
 */
export async function getPrivyUserId(req: NextRequest): Promise<string | null> {
  try {
    const claims = await verifyPrivyToken(req);
    return claims.sub;
  } catch {
    return null;
  }
}

export function getPrivyErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("missing privy auth token") ||
    message.includes("jwt") ||
    message.includes("jws") ||
    message.includes("signature verification failed") ||
    message.includes("token is invalid")
  ) {
    return 401;
  }

  return 500;
}
