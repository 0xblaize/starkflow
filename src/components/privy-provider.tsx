"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    // Render children without Privy in dev if the env var isn't set yet
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google"],
        appearance: {
          theme: "dark",
          accentColor: "#3151ff",
          logo: "/logo.png",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off", // We manage wallets via StarkZap
          },
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
