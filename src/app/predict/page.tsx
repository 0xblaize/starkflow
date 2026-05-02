"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PredictView } from "./predict-ui";
import { usePrivyProfile } from "@/lib/use-privy-profile";

export default function PredictPage() {
  const { getAccessToken, loadingProfile, logout, profile, ready, user } =
    usePrivyProfile();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  if (!ready || loadingProfile || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
      </main>
    );
  }

  const displayName =
    profile.username?.trim()
      ? `@${profile.username}.stark`
      : user?.google?.name ?? user?.email?.address ?? "StarkFlow User";
  const displayEmail =
    user?.email?.address ?? user?.google?.email ?? "Authenticated via Privy";

  return (
    <PredictView
      getAccessToken={getAccessToken}
      preferredNetwork={profile.preferredNetwork === "mainnet" ? "mainnet" : "sepolia"}
      signOutAction={handleSignOut}
      user={{
        name: displayName,
        email: displayEmail,
      }}
    />
  );
}
