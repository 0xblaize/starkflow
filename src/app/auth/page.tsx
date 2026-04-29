"use client";

import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 3 18 5.5V11c0 4.2-2.6 7.3-6 8.9C8.6 18.3 6 15.2 6 11V5.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DesktopBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(55,86,255,0.2),transparent_18%),radial-gradient(circle_at_50%_72%,rgba(55,86,255,0.12),transparent_24%),linear-gradient(180deg,rgba(20,23,33,0.96),rgba(2,3,6,0.98))]" />
      <div className="pointer-events-none absolute inset-x-14 top-1/2 h-28 -translate-y-1/2 rounded-full bg-[#3151ff]/12 blur-[96px]" />
      <div className="pointer-events-none absolute bottom-10 right-12 hidden items-center gap-2 rounded-full border border-[#2e3341] bg-[#151921] px-4 py-3 text-[12px] text-[#d0d7eb] shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:flex">
        <span className="text-[#3B5BFF]">
          <ShieldIcon />
        </span>
        <span>
          New to Starknet? <span className="text-[#5d79ff]">Learn more</span>
        </span>
      </div>
    </>
  );
}

function AuthPageInner() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const launchStartedRef = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const title =
    mode === "signup" ? "Create your StarkFlow profile" : "Sign in to StarkFlow";
  const helper =
    mode === "signup"
      ? "We'll open Privy so you can continue with Google and create your secure Starknet identity."
      : "We'll open Privy so you can sign in securely and continue into StarkFlow.";
  const ctaLabel =
    mode === "signup" ? "Open Privy Sign Up" : "Open Privy Sign In";

  async function openPrivy() {
    setLaunchError(null);
    setIsLaunching(true);

    try {
      await login();
    } catch (error) {
      console.error("[auth] Privy launch failed", error);
      setLaunchError(
        "StarkFlow could not reach Privy. Check your network, browser shields or extensions, and that localhost is allowed in your Privy app settings.",
      );
    } finally {
      setIsLaunching(false);
    }
  }

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;

    async function routeAuthenticatedUser() {
      setRedirecting(true);

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
            | { error?: string }
            | null;
          throw new Error(
            payload?.error
              ? `Failed to fetch profile state: ${payload.error}`
              : `Failed to fetch profile state (${response.status})`,
          );
        }

        const profile: { onboarded?: boolean } = await response.json();

        if (cancelled) return;

        router.push(profile.onboarded ? "/dashboard" : "/setup-profile");
      } catch (error) {
        console.error("[auth] failed to route authenticated user", error);
        if (!cancelled) {
          router.push(mode === "signup" ? "/setup-profile" : "/dashboard");
        }
      }
    }

    void routeAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, router, getAccessToken]);

  useEffect(() => {
    if (!ready || authenticated || launchStartedRef.current) return;
    launchStartedRef.current = true;
    void openPrivy();
  }, [ready, authenticated]);

  if (!ready || redirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="relative min-h-screen overflow-hidden">
        <DesktopBackground />

        <div className="relative z-10 min-h-screen px-4 py-5 md:flex md:items-center md:justify-center md:px-8 md:py-8">
          <Link
            href="/"
            className="absolute right-6 top-6 hidden items-center justify-center rounded-[8px] border border-[#3a3f4f] bg-[#2a2e38] p-3 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] md:inline-flex"
          >
            <CloseIcon />
          </Link>

          <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[560px] flex-col justify-between rounded-[18px] border border-[#252b37] bg-[#22252d] px-6 py-7 shadow-[0_34px_90px_rgba(0,0,0,0.45)] md:min-h-0 md:px-9 md:py-8">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex rounded-full border border-[#7fe4b4] bg-[#e8fff2] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b9b60]">
                  Gas Tank: 100% (Sponsored by AVNU)
                </div>
                <Link href="/" className="text-[#8d94a8] md:hidden">
                  <CloseIcon />
                </Link>
              </div>

              <div className="mt-8 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white md:h-18 md:w-18">
                  <Image
                    src="/logo.png"
                    alt="StarkFlow logo"
                    width={40}
                    height={40}
                    className="h-10 w-auto object-contain"
                    style={{ width: "auto", height: "40px" }}
                  />
                </div>
              </div>

              <div className="mt-8 text-center">
                <h1 className="[font-family:var(--font-syne)] text-[32px] leading-[1.05] tracking-[-0.04em] text-white md:text-[40px]">
                  {title}
                </h1>
                <p className="mx-auto mt-4 max-w-[390px] text-[15px] leading-7 text-[#aab1c4] md:text-[16px]">
                  {helper}
                </p>
              </div>

              <div className="mt-9 rounded-[14px] border border-[#2d3341] bg-[#181c24] px-4 py-4 md:px-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#10172b] text-[#3B5BFF]">
                    <ShieldIcon />
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-white">
                      No seed phrase required
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-[#a2a8bb]">
                      Your secure Starknet account is created and connected through
                      Privy, then managed inside StarkFlow with sponsored gas where
                      available.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => void openPrivy()}
                disabled={isLaunching}
                className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#3151ff] px-5 text-[17px] font-semibold text-white shadow-[0_18px_40px_rgba(49,81,255,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isLaunching ? "Opening Privy..." : ctaLabel}
                <ArrowRightIcon />
              </button>

              <p className="mt-5 text-center text-[14px] text-[#8f95a8]">
                If the Privy window didn&apos;t open, tap the button again.
              </p>

              {launchError ? (
                <div className="mt-4 rounded-[10px] border border-[#4a2d31] bg-[#24181b] px-4 py-3 text-[13px] leading-6 text-[#efb6be]">
                  {launchError}
                </div>
              ) : null}

              <div className="mt-7 flex items-center justify-center gap-5 text-[13px] text-[#b7bdcf]">
                <a href="#" className="underline underline-offset-4">
                  Privacy Policy
                </a>
                <a href="#" className="underline underline-offset-4">
                  Terms of Service
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
        </main>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}
