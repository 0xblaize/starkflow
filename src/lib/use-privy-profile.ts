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

const profileMemoryCache = new Map<string, PrivyProfileState>();

function getProfileCacheKey(userId?: string | null) {
  return userId ? `starkflow:profile:${userId}` : null;
}

function readCachedProfile(userId?: string | null) {
  const cacheKey = getProfileCacheKey(userId);
  if (!cacheKey) return null;

  const inMemory = profileMemoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrivyProfileState;
    profileMemoryCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string | null | undefined, profile: PrivyProfileState) {
  const cacheKey = getProfileCacheKey(userId);
  if (!cacheKey) return;

  profileMemoryCache.set(cacheKey, profile);

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(profile));
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

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
    const cachedProfile = readCachedProfile(user?.id);

    if (cachedProfile) {
      setProfile(cachedProfile);
      setLoadingProfile(false);

      if (!cachedProfile.onboarded) {
        router.push("/setup-profile");
      }
    }

    async function loadProfile() {
      if (!cachedProfile) {
        setLoadingProfile(true);
      }

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
          const payload = (await response.json().catch(() => null)) as
            | { details?: string; error?: string }
            | null;
          const detail = payload?.details ?? payload?.error ?? "Unknown profile error";
          throw new Error(
            `Failed to fetch profile (${response.status}): ${detail}`,
          );
        }

        const nextProfile: PrivyProfileState = await response.json();

        if (cancelled) return;

        if (!nextProfile.onboarded) {
          router.push("/setup-profile");
          return;
        }

        writeCachedProfile(user?.id, nextProfile);
        setProfile(nextProfile);
      } catch (error) {
        if (cachedProfile) {
          console.warn("[usePrivyProfile] profile refresh failed, using cached profile:", error);
          setProfile(cachedProfile);
        } else {
          console.error("[usePrivyProfile] profile load error:", error);
        }
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
  }, [authenticated, getAccessToken, ready, router, user?.id]);

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
