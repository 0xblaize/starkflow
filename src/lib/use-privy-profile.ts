"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";

export type PrivyProfileState = {
  handlePublic?: boolean;
  id: string;
  image?: string | null;
  onboarded: boolean;
  preferredNetwork?: "sepolia" | "mainnet";
  starknetAddress?: string | null;
  username?: string | null;
};

export function usePrivyProfile() {
  const { authenticated, getAccessToken, logout, ready, user } = usePrivy();
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<PrivyProfileState | null>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/auth");
    }
  }, [authenticated, ready, router]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);

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

        const nextProfile: PrivyProfileState = await response.json();

        if (cancelled) return;

        if (!nextProfile.onboarded) {
          router.push("/setup-profile");
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        console.error("[usePrivyProfile] profile load error:", error);
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, ready, router]);

  return {
    authenticated,
    getAccessToken,
    loadingProfile,
    logout,
    profile,
    ready,
    user,
  };
}
