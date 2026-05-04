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

type CachedProfileRecord = {
  cachedAt: number;
  profile: PrivyProfileState;
};

const profileMemoryCache = new Map<string, CachedProfileRecord>();
const pendingProfileRequests = new Map<string, Promise<PrivyProfileState>>();
const PROFILE_CACHE_TTL_MS = 45_000;
const PROFILE_REQUEST_TIMEOUT_MS = 6_500;

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
    const parsed = JSON.parse(raw) as
      | CachedProfileRecord
      | PrivyProfileState;
    const record =
      "profile" in parsed && "cachedAt" in parsed
        ? parsed
        : {
            cachedAt: 0,
            profile: parsed,
          };
    profileMemoryCache.set(cacheKey, record);
    return record;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string | null | undefined, profile: PrivyProfileState) {
  const cacheKey = getProfileCacheKey(userId);
  if (!cacheKey) return;

  const record: CachedProfileRecord = {
    cachedAt: Date.now(),
    profile,
  };

  profileMemoryCache.set(cacheKey, record);

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(record));
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

async function fetchPrivyProfile(
  userId: string,
  getAccessToken: () => Promise<string | null>,
) {
  const pending = pendingProfileRequests.get(userId);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const token = await waitForPrivyAccessToken(getAccessToken);

    if (!token) {
      throw new Error("Privy access token was not ready");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-privy-user-id": userId,
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Profile request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { details?: string; error?: string }
        | null;
      const detail = payload?.details ?? payload?.error ?? "Unknown profile error";
      throw new Error(`Failed to fetch profile (${response.status}): ${detail}`);
    }

    return (await response.json()) as PrivyProfileState;
  })().finally(() => {
    pendingProfileRequests.delete(userId);
  });

  pendingProfileRequests.set(userId, request);
  return request;
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
    const cachedRecord = readCachedProfile(user?.id);
    const cachedProfile = cachedRecord?.profile ?? null;
    const isCacheFresh =
      cachedRecord != null &&
      Date.now() - cachedRecord.cachedAt < PROFILE_CACHE_TTL_MS;

    if (cachedProfile) {
      setProfile(cachedProfile);
      setLoadingProfile(false);

      if (!cachedProfile.onboarded) {
        router.push("/setup-profile");
      }
    }

    if (cachedProfile && isCacheFresh) {
      return () => {
        cancelled = true;
      };
    }

    async function loadProfile() {
      if (!cachedProfile) {
        setLoadingProfile(true);
      }

      try {
        if (!user?.id) {
          throw new Error("Privy user id is unavailable.");
        }

        const nextProfile = await fetchPrivyProfile(user.id, getAccessToken);

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
