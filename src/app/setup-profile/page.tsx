"use client";

import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";

type ActionState = { error?: string };

type ProfileState = {
  image?: string | null;
  onboarded?: boolean;
  preferredNetwork?: "mainnet" | "sepolia";
  username?: string | null;
};

function normalizeUsername(input: string) {
  return input
    .trim()
    .replace(/^@/, "")
    .replace(/\.stark$/i, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export default function SetupProfilePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [username, setUsername] = useState("");
  const [preferredNetwork, setPreferredNetwork] = useState<"mainnet" | "sepolia">(
    "sepolia",
  );
  const [imageData, setImageData] = useState("");

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/auth");
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;

    async function loadProfileState() {
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

        const profile: ProfileState = await response.json();

        if (cancelled) return;

        if (profile.onboarded) {
          router.push("/dashboard");
          return;
        }

        setUsername(profile.username ?? "");
        setPreferredNetwork(
          profile.preferredNetwork === "mainnet" ? "mainnet" : "sepolia",
        );
        setImageData(profile.image ?? "");
        setCheckingProfile(false);
      } catch (fetchError) {
        console.error("[setup-profile] profile state error:", fetchError);
        if (!cancelled) {
          setCheckingProfile(false);
        }
      }
    }

    void loadProfileState();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, router]);

  if (!ready || !authenticated || checkingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05060a] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3151ff] border-t-transparent" />
      </main>
    );
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function removeImage() {
    setImageData("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be 5MB or smaller.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageData(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      setSubmitting(false);
      return;
    }
    if (normalizedUsername.length > 24) {
      setError("Username must be under 24 characters.");
      setSubmitting(false);
      return;
    }

    try {
      const token = await waitForPrivyAccessToken(getAccessToken);

      if (!token) {
        throw new Error("Privy access token was not ready");
      }

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: normalizedUsername,
          preferredNetwork,
          imageData,
        }),
      });
      const data: ActionState = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      const token = await waitForPrivyAccessToken(getAccessToken);

      if (!token) {
        throw new Error("Privy access token was not ready");
      }

      await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ skip: true }),
      });
    } catch {
      // ignore
    }
    router.push("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(49,81,255,0.18),transparent_22%),radial-gradient(circle_at_82%_72%,rgba(49,81,255,0.12),transparent_24%),linear-gradient(180deg,rgba(20,23,33,0.94),rgba(2,3,6,0.98))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[720px] flex-col items-center justify-center gap-6 lg:max-w-[840px]">
        <div className="w-full rounded-[24px] border border-[#2a2f3c] bg-[#1a1d25] p-6 shadow-[0_30px_70px_rgba(14,15,84,0.3)] md:p-8 lg:p-10">
          <h1 className="[font-family:var(--font-syne)] text-[32px] font-semibold leading-[1.05] md:text-[40px] lg:text-[48px]">
            Set up your profile
          </h1>
          <p className="mt-3 max-w-[460px] text-[15px] leading-7 text-[#8a93aa] md:text-[16px]">
            Upload a profile picture, choose a StarkFlow username, and pick the
            side you want active first.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6 md:mt-10">
            <div className="flex flex-col items-center">
              <div className="relative h-[132px] w-[132px] rounded-full border-[3px] border-dashed border-[#38405e] bg-[#161b2b] md:h-[156px] md:w-[156px]">
                {imageData ? (
                  <Image
                    src={imageData}
                    alt="Profile preview"
                    fill
                    className="rounded-full object-cover"
                    sizes="156px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#161b2b] text-[42px] font-semibold text-[#dbe0ef] md:text-[48px]">
                    {(username.trim().charAt(0) || "S").toUpperCase()}
                  </div>
                )}

                <span className="absolute bottom-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#38405e] bg-[#161b2b] text-[#dbe0ef] shadow-[0_10px_20px_rgba(0,0,0,0.12)]">
                  <UploadIcon />
                </span>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="rounded-[10px] border border-[#38405e] bg-[#161b2b] px-4 py-2.5 text-[15px] font-medium text-[#dbe0ef]"
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  className="text-[15px] font-medium text-[#dbe0ef]"
                >
                  Remove
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <p className="mt-3 text-[13px] text-[#8a93aa]">
                Square image recommended. Max 5MB.
              </p>
            </div>

            <div>
              <label
                className="mb-2 block text-[13px] font-semibold text-[#c5ccde]"
                htmlFor="username"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="satoshi"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-[12px] border border-[#343946] bg-[#181c24] px-4 py-3 text-[15px] text-white placeholder-[#4a5066] outline-none focus:border-[#3151ff] md:py-4 md:text-[18px]"
              />
              <p className="mt-2 text-[13px] text-[#8a93aa]">
                Choose a unique handle like{" "}
                <span className="text-[#7ea1ff]">@yourname.stark</span>.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-semibold text-[#c5ccde]">
                Preferred Network
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPreferredNetwork("sepolia")}
                  className={`rounded-[14px] border px-4 py-4 text-left transition ${
                    preferredNetwork === "sepolia"
                      ? "border-[#3151ff] bg-[#11204f] shadow-[0_12px_24px_rgba(49,81,255,0.12)]"
                      : "border-[#38405e] bg-[#161b2b]"
                  }`}
                >
                  <p className="text-[16px] font-semibold text-[#dbe0ef]">Sepolia</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#8a93aa]">
                    Sandbox side for testing Starknet flows.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferredNetwork("mainnet")}
                  className={`rounded-[14px] border px-4 py-4 text-left transition ${
                    preferredNetwork === "mainnet"
                      ? "border-[#3151ff] bg-[#11204f] shadow-[0_12px_24px_rgba(49,81,255,0.12)]"
                      : "border-[#38405e] bg-[#161b2b]"
                  }`}
                >
                  <p className="text-[16px] font-semibold text-[#dbe0ef]">Mainnet</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#8a93aa]">
                    Production side for live funds.
                  </p>
                </button>
              </div>
              <p className="mt-2 text-[13px] text-[#8a93aa]">
                Testnet is highly recommended while setting up and testing StarkFlow.
              </p>
            </div>

            {error ? (
              <p className="rounded-[10px] border border-[#5c1b1b] bg-[#1c0808] px-4 py-3 text-[13px] text-[#ff6b6b]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="h-[54px] w-full rounded-[12px] bg-[#3151ff] text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-60 md:h-[58px] md:text-[16px]"
            >
              {submitting ? "Saving..." : "Save Profile"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="mt-4 w-full text-center text-[13px] text-[#8a93aa] underline underline-offset-4 hover:text-white"
          >
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 16V8m0 0-3 3m3-3 3 3M5 16.5V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
