import { PrivyClient } from "@privy-io/node";

let privyClient: PrivyClient | null = null;

export function getPrivyAppId() {
  const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error("Missing PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID");
  }

  return appId;
}

export function getPrivyClient() {
  const appId = getPrivyAppId();
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appSecret) {
    throw new Error("Missing PRIVY_APP_SECRET");
  }

  if (!privyClient) {
    privyClient = new PrivyClient({
      appId,
      appSecret,
    });
  }

  return privyClient;
}
