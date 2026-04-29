"use client";

import Image from "next/image";
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = {
  error?: string;
};

type ProfileSetupFormProps = {
  initialImage?: string | null;
  initialNetwork: "mainnet" | "sepolia";
  initialPublic: boolean;
  initialUsername: string;
  mode: "setup" | "edit";
  saveAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  skipAction?: () => Promise<void>;
};

export function ProfileSetupForm({
  initialImage,
  initialNetwork,
  initialPublic,
  initialUsername,
  mode,
  saveAction,
  skipAction,
}: ProfileSetupFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState(saveAction, {});
  const [username, setUsername] = useState(initialUsername);
  const [network, setNetwork] = useState<"mainnet" | "sepolia">(initialNetwork);
  const [handlePublic, setHandlePublic] = useState(initialPublic);
  const [imageData, setImageData] = useState(initialImage ?? "");

  const previewLabel = useMemo(() => {
    if (!username.trim()) return "@ yourname.stark";
    return `@ ${username
      .trim()
      .replace(/^@/, "")
      .replace(/\.stark$/i, "")
      .replace(/\s+/g, "_")}`;
  }, [username]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageData("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="preferredNetwork" value={network} />
      <input type="hidden" name="handlePublic" value={String(handlePublic)} />
      <input type="hidden" name="imageData" value={imageData} />

      <div className="rounded-[24px] border border-[#272c35] bg-[#1f232b] p-5 text-[#dbe0ef] shadow-[0_30px_70px_rgba(14,15,84,0.35)] md:rounded-[28px] md:p-8 lg:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[460px]">
            <h1 className="[font-family:var(--font-syne)] text-[34px] font-semibold leading-[1.02] md:text-[44px] lg:text-[52px]">
              {mode === "setup" ? "Set up your profile" : "Update your profile"}
            </h1>
            <p className="mt-3 max-w-[420px] text-[16px] leading-7 text-[#adb4c7] md:text-[17px]">
              Upload a profile picture, choose your StarkFlow username and pick
              which side you want active first.
            </p>
          </div>

          <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#232836] text-[#dbe0ef]">
              <CloseIcon />
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center md:mt-10">
          <AvatarPreview imageData={imageData} />

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

          <p className="mt-3 text-[13px] text-[#adb4c7]">
            Square image recommended. Max 5MB.
          </p>
        </div>

        <div className="mt-8 md:mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor="starkflow-username"
              className="text-[15px] font-semibold text-[#dbe0ef]"
            >
              StarkFlow username
            </label>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#7ea1ff]">
              <AvailabilityIcon />
              Available
            </span>
          </div>

          <input
            id="starkflow-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@ stark_pioneer"
            className="h-14 w-full rounded-[12px] border border-[#38405e] bg-[#161b2b] px-4 text-[20px] text-[#dbe0ef] outline-none placeholder:text-[#adb4c7] focus:border-[#3151ff] md:h-16 md:text-[22px]"
          />

          <p className="mt-3 text-[14px] text-[#adb4c7]">
            Choose a unique handle, for example{" "}
            <span className="text-[#3151ff]">@yourname.stark</span>.
          </p>
        </div>

        <div className="mt-6 md:mt-8">
          <p className="text-[15px] font-semibold text-[#dbe0ef]">Network side</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NetworkButton
              active={network === "mainnet"}
              description="Production side for live funds."
              label="Mainnet"
              onClick={() => setNetwork("mainnet")}
            />
            <NetworkButton
              active={network === "sepolia"}
              description="Sandbox side for testing Starknet flows."
              label="Sepolia"
              onClick={() => setNetwork("sepolia")}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHandlePublic((value) => !value)}
          className="mt-6 flex w-full flex-col items-start justify-between gap-3 rounded-[14px] border border-[#38405e] bg-[#161b2b] px-4 py-4 text-left md:mt-8 md:flex-row md:items-center"
        >
          <span className="flex items-center gap-3">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] ${
                handlePublic ? "bg-[#3151ff] text-white" : "bg-[#161b2b] text-transparent"
              }`}
            >
              <CheckMark />
            </span>
            <span className="text-[16px] font-medium text-[#dbe0ef]">
              Show my handle publicly
            </span>
            <HelpIcon />
          </span>
          <span className="text-[12px] font-medium text-[#adb4c7]">{previewLabel}</span>
        </button>

        {state.error ? (
          <p className="mt-4 text-[14px] font-medium text-[#ff6b6b]">{state.error}</p>
        ) : null}

        <SubmitButton label={mode === "setup" ? "Continue" : "Save Profile"} />

        {mode === "setup" && skipAction ? (
          <div className="mt-5 text-center">
            <button
              type="submit"
              formAction={skipAction}
              className="text-[16px] font-medium text-[#adb4c7]"
            >
              Skip for now
            </button>
          </div>
        ) : null}

        <p className="mt-8 text-center text-[13px] leading-6 text-[#adb4c7]">
          No seed phrase required. Your profile is tied to your Starknet
          identity. <span className="text-[#3151ff]">Privacy Policy</span>
        </p>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-7 flex h-[54px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#3151ff] text-[18px] font-semibold text-white disabled:opacity-70"
    >
      {pending ? "Saving..." : label}
      <ChevronIcon />
    </button>
  );
}

function AvatarPreview({ imageData }: { imageData: string }) {
  return (
    <div className="relative h-[126px] w-[126px] rounded-full border-[3px] border-dashed border-[#38405e] bg-[#161b2b] md:h-[156px] md:w-[156px]">
      {imageData ? (
        <Image
          src={imageData}
          alt="Profile preview"
          fill
          className="rounded-full object-cover"
          sizes="126px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#161b2b] text-[42px] font-semibold text-[#dbe0ef]">
          S
        </div>
      )}

      <span className="absolute bottom-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#38405e] bg-[#161b2b] text-[#dbe0ef] shadow-[0_10px_20px_rgba(0,0,0,0.12)] md:h-12 md:w-12">
        <UploadIcon />
      </span>
    </div>
  );
}

function NetworkButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-4 py-4 text-left transition ${
        active
          ? "border-[#3151ff] bg-[#11204f] shadow-[0_12px_24px_rgba(49,81,255,0.12)]"
          : "border-[#38405e] bg-[#161b2b]"
      }`}
    >
      <p className="text-[16px] font-semibold text-[#dbe0ef] md:text-[17px]">{label}</p>
      <p className="mt-2 text-[13px] leading-5 text-[#adb4c7]">{description}</p>
    </button>
  );
}

function ChevronIcon() {
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

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
      <path
        d="m6 12 4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function AvailabilityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.5 12.5 2.2 2.2 4.8-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6a7285]" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 16v-.5c0-1.3 1.4-1.8 2.3-2.8.7-.8.8-2.2-.4-3.1-1-.7-2.6-.6-3.6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="18.2" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
