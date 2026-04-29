"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { DashboardView } from "./dashboard-ui";
import { normalizePreferredNetwork } from "@/lib/app-user";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";

type OnboardResult = {
  address: string;
  network: "sepolia" | "mainnet";
  deployed: boolean;
};

type ProfileStatus = {
  onboarded: boolean;
  preferredNetwork?: "sepolia" | "mainnet";
  starknetAddress?: string | null;
};

export default function DashboardPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const router = useRouter();

  const [starknetAddress, setStarknetAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<"sepolia" | "mainnet">("sepolia");
  const [walletDeployed, setWalletDeployed] = useState<boolean | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/auth");
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;

    async function ensureProfileComplete() {
      setCheckingProfile(true);

      try {
        const token = await waitForPrivyAccessToken(getAccessToken);

        if (!token) {
          throw new Error("Privy access token was not ready");
        }

        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const profile: ProfileStatus = await response.json();

        if (cancelled) return;

        if (!profile.onboarded) {
          router.push("/setup-profile");
          return;
        }

        if (profile.starknetAddress) {
          setStarknetAddress(profile.starknetAddress);
        }

        if (profile.preferredNetwork) {
          setNetwork(normalizePreferredNetwork(profile.preferredNetwork));
        }

        setCheckingProfile(false);
      } catch (error) {
        console.error("[dashboard] profile check error:", error);
        if (!cancelled) {
          setCheckingProfile(false);
        }
      }
    }

    void ensureProfileComplete();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, router]);

  // Onboard wallet once authenticated
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
    if (authenticated && !checkingProfile) {
      void onboard();
    }
  }, [authenticated, checkingProfile, onboard]);

  const handleSignOut = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  if (!ready || !authenticated || checkingProfile) {
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
