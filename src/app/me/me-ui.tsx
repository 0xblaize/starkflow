import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import {
  accountLinks,
  legalLinks,
  personalStats,
  preferenceLinks,
  quickStats,
  resources,
  supportLinks,
} from "./me-data";

type MeViewProps = {
  signOutAction: () => Promise<void>;
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    preferredNetwork?: "mainnet" | "sepolia";
    handlePublic?: boolean;
    starknetAddress?: string | null;
  };
};

export function MeView({
  signOutAction,
  updatePreferredNetworkAction,
  user,
}: MeViewProps) {
  const username = user.username?.trim() || "stark-user";
  const handle = `@${username}.stark`;
  const profileName = handle;
  const shortAddress = user.starknetAddress
    ? `${user.starknetAddress.slice(0, 8)}...${user.starknetAddress.slice(-6)}`
    : "No wallet linked";
  const activeNetwork =
    user.preferredNetwork === "sepolia" ? "Sepolia Side" : "Mainnet Side";

  return (
    <TopbarAppShell
      title="Personal Hub"
      currentSection="me"
      signOutAction={signOutAction}
      user={user}
    >
      <DesktopPersonalHub
        handle={handle}
        profileName={profileName}
        shortAddress={shortAddress}
        signOutAction={signOutAction}
        updatePreferredNetworkAction={updatePreferredNetworkAction}
        user={user}
        activeNetwork={activeNetwork}
      />

      <MobilePersonalHub
        handle={handle}
        profileName={profileName}
        shortAddress={shortAddress}
        signOutAction={signOutAction}
        updatePreferredNetworkAction={updatePreferredNetworkAction}
        user={user}
        activeNetwork={activeNetwork}
      />
    </TopbarAppShell>
  );
}

function DesktopPersonalHub({
  handle,
  profileName,
  shortAddress,
  signOutAction,
  updatePreferredNetworkAction,
  user,
  activeNetwork,
}: {
  profileName: string;
  handle: string;
  shortAddress: string;
  signOutAction: () => Promise<void>;
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  user: MeViewProps["user"];
  activeNetwork: string;
}) {
  return (
    <section className="hidden md:block">
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <ProfilePanel
            compact={false}
            handle={handle}
            profileName={profileName}
            shortAddress={shortAddress}
            updatePreferredNetworkAction={updatePreferredNetworkAction}
            user={user}
            activeNetwork={activeNetwork}
          />

          <section className="rounded-[18px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
              Quick Stats
            </p>

            <div className="mt-4 space-y-3">
              {quickStats.map((item, index) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-3 ${
                    index < quickStats.length - 1 ? "border-b border-[#262b35] pb-3" : ""
                  }`}
                >
                  <span className="text-[13px] text-[#98a1b5]">{item.label}</span>
                  <span className="text-[14px] font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[#f04d4d] text-[14px] font-semibold text-white"
            >
              Sign Out from Device
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <SecurityPanel email={user.email} />
          <PreferencesPanel />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px]">
            <FooterList title="Resources" items={resources} />
            <FooterList title="Legal" items={legalLinks} />
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#919aac]">
                App Version
              </p>
              <div className="mt-4 rounded-[14px] border border-[#272c35] bg-[#171b22] px-4 py-3 text-[13px] font-semibold text-white">
                v2.4.1 stable
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[#7d8699]">
                Made for Starknet.
                <br />
                Secure, gasless, social.
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobilePersonalHub({
  handle,
  profileName,
  shortAddress,
  signOutAction,
  updatePreferredNetworkAction,
  user,
  activeNetwork,
}: {
  profileName: string;
  handle: string;
  shortAddress: string;
  signOutAction: () => Promise<void>;
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  user: MeViewProps["user"];
  activeNetwork: string;
}) {
  return (
    <section className="md:hidden">
      <ProfilePanel
        compact
        handle={handle}
        profileName={profileName}
        shortAddress={shortAddress}
        updatePreferredNetworkAction={updatePreferredNetworkAction}
        user={user}
        activeNetwork={activeNetwork}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        {personalStats.map((item) => (
          <section
            key={item.label}
            className="rounded-[16px] border border-[#2b3039] bg-[#1b1f26] px-4 py-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d96ac]">
              {item.label}
            </p>
            <p className="mt-3 [font-family:var(--font-syne)] text-[28px] font-semibold leading-none text-white">
              {item.value}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-[#3fbe78]">{item.accent}</p>
          </section>
        ))}
      </div>

      <section className="mt-4 rounded-[16px] border border-[#2b3058] bg-[#11183b] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#86a0ff]">
              <SessionKeyIcon />
            </span>
            <p className="text-[15px] font-semibold text-white">Session Keys</p>
          </div>
          <Toggle enabled={false} />
        </div>

        <p className="mt-3 text-[13px] leading-6 text-[#98a4d3]">
          Auto-sign transactions and skip biometric prompts for the next 2
          hours. Securely stored in your local vault.
        </p>
      </section>

      <div className="mt-5 space-y-3">
        <MobileSection title="Account & Security" items={accountLinks} />
        <MobileSection title="Preferences" items={preferenceLinks} />
        <MobileSection title="Support" items={supportLinks} />
      </div>

      <div className="mt-8 text-center">
        <p className="text-[11px] text-[#727b90]">StarkFlow ({activeNetwork})</p>
        <p className="mt-1 text-[11px] text-[#727b90]">Powered by Starkzap</p>

        <form action={signOutAction} className="mt-4">
          <button type="submit" className="text-[14px] font-semibold text-[#ff4c4c]">
            Sign Out
          </button>
        </form>
      </div>
    </section>
  );
}

function ProfilePanel({
  compact,
  handle,
  profileName,
  shortAddress,
  user,
  updatePreferredNetworkAction,
  activeNetwork,
}: {
  compact?: boolean;
  profileName: string;
  handle: string;
  shortAddress: string;
  user: MeViewProps["user"];
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  activeNetwork: string;
}) {
  const preferredNetwork = user.preferredNetwork === "mainnet" ? "mainnet" : "sepolia";

  return (
    <section
      className={`rounded-[20px] border border-[#262b34] bg-[linear-gradient(180deg,#242472,#1b1f30)] ${
        compact ? "px-4 py-5 text-center" : "px-5 py-5"
      }`}
    >
      <div className={compact ? "" : "text-center"}>
        <Avatar name={profileName} src={user.image} compact={compact} />
        <h1
          className={`mt-4 break-words [font-family:var(--font-syne)] font-semibold text-white ${
            compact ? "text-[28px]" : "text-[34px] leading-[1.02] 2xl:text-[38px]"
          }`}
        >
          {profileName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <p className="text-[15px] font-semibold text-[#82a0ff]">{activeNetwork}</p>
          <span className="rounded-full bg-[#3151ff] px-2 py-0.5 text-[10px] font-semibold text-white">
            {user.handlePublic ? "Public" : "Private"}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-[14px] border border-[#2b3058] bg-[#171b22] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
          Starknet Address
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-white">{shortAddress}</p>
          <CopyIcon />
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[#2b3058] bg-[#171b22] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
              Active Side
            </p>
            <p className="mt-1 text-[14px] font-semibold text-white">{activeNetwork}</p>
          </div>
          <span className="rounded-full bg-[#2e356e] px-3 py-1 text-[11px] font-semibold text-[#9cb0ff]">
            Tap to switch
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <NetworkSwitchButton
            action={updatePreferredNetworkAction}
            active={preferredNetwork === "sepolia"}
            label="Sepolia"
            value="sepolia"
          />
          <NetworkSwitchButton
            action={updatePreferredNetworkAction}
            active={preferredNetwork === "mainnet"}
            label="Mainnet"
            value="mainnet"
          />
        </div>
      </div>

      {compact ? (
        <Link
          href="/setup-profile?edit=1"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-[12px] bg-black text-[14px] font-semibold text-white"
        >
          Edit Profile
        </Link>
      ) : null}

      {compact ? null : (
        <>
          <Link
            href="/setup-profile?edit=1"
            className="mt-4 flex h-11 w-full items-center justify-center rounded-[12px] bg-black text-[14px] font-semibold text-white"
          >
            Edit Profile
          </Link>
        </>
      )}
    </section>
  );
}

function NetworkSwitchButton({
  action,
  active,
  label,
  value,
}: {
  action: (formData: FormData) => Promise<void>;
  active: boolean;
  label: string;
  value: "mainnet" | "sepolia";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="preferredNetwork" value={value} />
      <button
        type="submit"
        className={`flex h-11 w-full items-center justify-center rounded-[12px] border text-[13px] font-semibold transition ${
          active
            ? "border-[#4f68ff] bg-[#3151ff] text-white"
            : "border-[#303651] bg-[#1f2436] text-[#aeb9d6] hover:border-[#47538b] hover:text-white"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function Avatar({
  compact,
  name,
  src,
}: {
  name: string;
  src?: string | null;
  compact?: boolean;
}) {
  const size = compact ? 84 : 92;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-full border border-white/10 bg-[#e8efc8]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover"
          sizes={compact ? "84px" : "92px"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#e8efc8] text-[30px] font-semibold text-[#10141b]">
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1d2141] bg-[#3151ff]">
        <CheckIcon />
      </span>
    </div>
  );
}

function SecurityPanel({ email }: { email?: string | null }) {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[#5c7eff]">
          <ShieldIcon />
        </span>
        <h2 className="[font-family:var(--font-syne)] text-[28px] font-semibold text-white">
          Security & Authentication
        </h2>
      </div>

      <div className="mt-5 space-y-3">
        <ProviderRow
          icon={<GoogleIcon />}
          title="Google Account"
          subtitle={email ?? "Connected session"}
          status="Connected"
        />
        <ProviderRow
          icon={<XIcon />}
          title="Twitter / X"
          subtitle="Integration paused for now"
          status="Paused"
        />
        <ProviderRow
          icon={<MailIcon />}
          title="Email Identity"
          subtitle={email ?? "No email available"}
          status={email ? "Connected" : "Pending"}
        />
      </div>

      <div className="mt-5 border-t border-[#272c35] pt-4">
        <button type="button" className="text-[13px] font-semibold text-[#4f75ff]">
          Add Recovery Method
        </button>
      </div>
    </section>
  );
}

function PreferencesPanel() {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[#5c7eff]">
          <BoltIcon />
        </span>
        <h2 className="[font-family:var(--font-syne)] text-[28px] font-semibold text-white">
          Preferences
        </h2>
      </div>

      <div className="mt-5 space-y-3">
        <PreferenceRow
          icon={<BoltIcon />}
          title="Gas Sponsorship"
          subtitle="Automatically use StarkFlow-sponsored gas for eligible transactions."
          enabled
        />
        <PreferenceRow
          icon={<BellLineIcon />}
          title="Push Notifications"
          subtitle="Get updates on deposits, swaps and social activity."
          enabled={false}
        />
        <PreferenceRow
          icon={<FingerprintIcon />}
          title="Biometric Verification"
          subtitle="Require device confirmation for sensitive outgoing actions."
          enabled={false}
        />
        <PreferenceRow
          icon={<LockIcon />}
          title="Privacy Mode"
          subtitle="Hide your handle from public discovery until profile sharing is enabled."
          enabled={false}
        />
      </div>
    </section>
  );
}

function MobileSection({
  items,
  title,
}: {
  title: string;
  items: ReadonlyArray<{
    title: string;
    subtitle: string;
    status?: string;
    icon: string;
  }>;
}) {
  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7d8698]">
        {title}
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <InfoRow
            key={item.title}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            status={item.status}
          />
        ))}
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  status,
  subtitle,
  title,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#272c35] bg-[#1a1e25] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#20242d] text-[#9aa4bb]">
          <RowIcon type={icon} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[12px] text-[#8f97aa]">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {status ? (
          <span className="hidden rounded-full bg-[#232836] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b3bdd2] sm:inline-flex">
            {status}
          </span>
        ) : null}
        <ChevronRight />
      </div>
    </div>
  );
}

function ProviderRow({
  icon,
  status,
  subtitle,
  title,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-[#272c35] bg-[#14181f] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-black text-white">
          {icon}
        </span>
        <div>
          <p className="text-[14px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[12px] text-[#8e97aa]">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-semibold text-white">{status}</span>
        <ChevronRight />
      </div>
    </div>
  );
}

function PreferenceRow({
  enabled,
  icon,
  subtitle,
  title,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#272c35] bg-[#20242d] px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#1a1e25] text-[#5d7fff]">
          {icon}
        </span>
        <div>
          <p className="text-[14px] font-semibold text-white">{title}</p>
          <p className="mt-1 max-w-[440px] text-[12px] leading-5 text-[#8e97aa]">
            {subtitle}
          </p>
        </div>
      </div>
      <Toggle enabled={enabled} />
    </div>
  );
}

function FooterList({
  items,
  title,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#919aac]">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="block text-left text-[13px] text-[#d5daea] transition hover:text-white"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        enabled ? "bg-[#3151ff]" : "bg-[#5b5f68]"
      }`}
    >
      <span
        className={`absolute h-5 w-5 rounded-full bg-white transition ${
          enabled ? "left-6" : "left-1"
        }`}
      />
    </span>
  );
}

function RowIcon({ type }: { type: string }) {
  if (type === "shield") return <ShieldIcon />;
  if (type === "user") return <UserIcon />;
  if (type === "bolt") return <BoltIcon />;
  if (type === "gear") return <GearIcon />;
  return <DocIcon />;
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#8e97aa]" fill="none">
      <path
        d="M10 7 15 12l-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#8ea2ff]" fill="none">
      <path
        d="M9 9h9v11H9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6 15H5V4h9v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none">
      <path
        d="m7 12.5 3 3 7-8"
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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 3 18 5.5V11c0 4.2-2.6 7.3-6 8.9C8.6 18.3 6 15.2 6 11V5.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m19 12 2-1-1-3-2 .2-1.1-1.8 1-1.7-2.7-1.5-1.3 1.4h-2L10.6 3 7.9 4.5l1 1.7L7.8 8 6 7.8 5 11l2 1-.1 2L5 15l1 3 1.8-.2 1.1 1.8-1 1.7 2.7 1.5 1.3-1.4h2l1.3 1.4 2.7-1.5-1-1.7 1.1-1.8L19 18l1-3-2-1 .1-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M8 3h6l4 4v14H8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return <span className="text-[14px] font-semibold">G</span>;
}

function XIcon() {
  return <span className="text-[13px] font-semibold">X</span>;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M4 7h16v10H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m5 8 7 6 7-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellLineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M8 17h8m-7-3V10a3 3 0 1 1 6 0v4l1.4 2H7.6L9 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M9 9a3 3 0 1 1 6 0v2m-8 0V9a5 5 0 1 1 10 0v4m-8 0v2c0 2 1.2 3.8 3 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <rect
        x="6"
        y="11"
        width="12"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 11V8.5a3 3 0 1 1 6 0V11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SessionKeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M14 8a4 4 0 1 1-1.2 2.8L21 19l-2 2-1.8-1.8-1.4 1.4-1.6-1.6 1.4-1.4-1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

