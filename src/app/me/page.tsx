"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MeView } from "./me-ui";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import { usePrivyProfile } from "@/lib/use-privy-profile";

export default function MePage() {
  const { getAccessToken, loadingProfile, logout, profile, ready, user } =
    usePrivyProfile();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  const handlePreferredNetworkChange = useCallback(
    async (formData: FormData) => {
      const preferredNetwork =
        formData.get("preferredNetwork") === "mainnet" ? "mainnet" : "sepolia";

      const token = await waitForPrivyAccessToken(getAccessToken);

      if (!token) {
        throw new Error("Privy access token was not ready");
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferredNetwork }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preferred network");
      }

      router.refresh();
    },
    [getAccessToken, router],
  );

  if (!ready || loadingProfile || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
      </main>
    );
  }

  const displayName =
    user?.google?.name ?? user?.email?.address ?? profile.username ?? "StarkFlow User";
  const displayEmail =
    user?.email?.address ?? user?.google?.email ?? "Authenticated via Privy";

  return (
    <MeView
      signOutAction={handleSignOut}
      updatePreferredNetworkAction={handlePreferredNetworkChange}
      user={{
        name: displayName,
        email: displayEmail,
        image: profile.image,
        username: profile.username,
        preferredNetwork: normalizePreferredNetwork(profile.preferredNetwork),
        handlePublic: profile.handlePublic ?? true,
        starknetAddress: profile.starknetAddress,
      }}
    />
  );
}
