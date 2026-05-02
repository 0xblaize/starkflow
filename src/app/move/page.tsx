"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIdentityToken } from "@privy-io/react-auth";
import { MoveCenterView } from "./move-ui";
import { usePrivyProfile } from "@/lib/use-privy-profile";

function MovePageInner() {
  const { getAccessToken, loadingProfile, logout, profile, ready, user } = usePrivyProfile();
  const { identityToken } = useIdentityToken();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadAccessToken = useCallback(() => getAccessToken(), [getAccessToken]);

  const currentTab =
    searchParams.get("tab") === "swap" || searchParams.get("tab") === "bridge"
      ? (searchParams.get("tab") as "swap" | "bridge")
      : "send";

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
    <MoveCenterView
      currentTab={currentTab}
      getAccessToken={loadAccessToken}
      identityToken={identityToken}
      preferredNetwork={profile.preferredNetwork ?? "sepolia"}
      signOutAction={handleSignOut}
      starknetAddress={profile.starknetAddress ?? null}
      user={{
        name: displayName,
        email: displayEmail,
      }}
    />
  );
}

export default function MovePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
        </main>
      }
    >
      <MovePageInner />
    </Suspense>
  );
}
