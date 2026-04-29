"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { DashboardView } from "./dashboard-ui";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import { usePrivyProfile } from "@/lib/use-privy-profile";

type OnboardResult = {
  address: string;
  network: "sepolia" | "mainnet";
  deployed: boolean;
};

export default function DashboardPage() {
  const { authenticated, getAccessToken, loadingProfile, logout, profile, ready, user } =
    usePrivyProfile();
  const router = useRouter();

  const [starknetAddress, setStarknetAddress] = useState<string | null>(profile?.starknetAddress ?? null);
  const [network, setNetwork] = useState<"sepolia" | "mainnet">(
    normalizePreferredNetwork(profile?.preferredNetwork),
  );
  const [walletDeployed, setWalletDeployed] = useState<boolean | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setStarknetAddress(profile.starknetAddress ?? null);
    setNetwork(normalizePreferredNetwork(profile.preferredNetwork));
  }, [profile]);

  const onboard = useCallback(async () => {
    if (!authenticated) return;
    setOnboarding(true);
    try {
      const token = await waitForPrivyAccessToken(getAccessToken);

      if (!token) {
        throw new Error("Privy access token was not ready");
      }

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: OnboardResult = await res.json();
        setStarknetAddress(data.address);
        setNetwork(normalizePreferredNetwork(data.network));
        setWalletDeployed(data.deployed);
      }
    } catch (err) {
      console.error("[dashboard] onboard error:", err);
    } finally {
      setOnboarding(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (!authenticated || loadingProfile || !profile) return;
    if (profile.starknetAddress) return;
    if (onboarding) return;

    void onboard();
  }, [authenticated, loadingProfile, onboard, onboarding, profile]);

  const handleSignOut = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  if (!ready || !authenticated || loadingProfile || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
      </main>
    );
  }

  const displayName =
    user?.google?.name ??
    user?.email?.address ??
    user?.twitter?.name ??
    "StarkFlow User";
  const displayEmail =
    user?.email?.address ?? user?.google?.email ?? "Authenticated via Privy";

  return (
    <DashboardView
      signOutAction={handleSignOut}
      starknetAddress={starknetAddress}
      preferredNetwork={network}
      walletDeployed={walletDeployed}
      getAccessToken={getAccessToken}
      user={{
        name: displayName,
        email: displayEmail,
      }}
    />
  );
}
