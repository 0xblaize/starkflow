import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_JWKS_URL = "https://auth.privy.io/api/v1/apps/{appId}/jwks.json";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) {
    const url = PRIVY_JWKS_URL.replace("{appId}", PRIVY_APP_ID);
    _jwks = createRemoteJWKSet(new URL(url));
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
