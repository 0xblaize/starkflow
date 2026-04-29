"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import {
  dashboardTabs,
  feedEmptyStates,
  onchainAssets,
  type DashboardTab,
  type OnchainAsset,
} from "./dashboard-data";

type DashboardViewProps = {
  signOutAction: () => Promise<void>;
  starknetAddress?: string | null;
  preferredNetwork?: "sepolia" | "mainnet";
  walletDeployed?: boolean | null;
  getAccessToken: () => Promise<string | null>;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

type LiveBalances = {
  address?: string | null;
  fetchedAt?: number;
  network?: string;
  strk: string;
  usdc: string;
  strkbtc: string;
};

const balanceMemoryCache = new Map<string, LiveBalances>();

export function DashboardView({
  signOutAction,
  starknetAddress,
  preferredNetwork = "sepolia",
  walletDeployed = null,
  getAccessToken,
  user,
}: DashboardViewProps) {
  const [balances, setBalances] = useState<LiveBalances>({
    strk: "—",
    usdc: "—",
    strkbtc: "—",
  });

  const fetchBalances = useCallback(async () => {
    if (!starknetAddress) {
      setBalances({
        address: null,
        network: preferredNetwork,
        strk: "0.0000 STRK",
        usdc: "0.00 USDC",
        strkbtc: "0.0000 strkBTC",
      });
      return;
    }

    const cacheKey = `${preferredNetwork}:${starknetAddress}`;
    const cached = balanceMemoryCache.get(cacheKey);

    if (cached) {
      setBalances(cached);
    }

    try {
      const token = await waitForPrivyAccessToken(getAccessToken);
      if (!token) return;

      const res = await fetch("/api/balances", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: LiveBalances = await res.json();
        const nextBalances = { ...data, fetchedAt: Date.now() };
        balanceMemoryCache.set(cacheKey, nextBalances);
        setBalances(nextBalances);
      }
    } catch {
      // silently ignore — balances stay at last known value
    }
  }, [getAccessToken, preferredNetwork, starknetAddress]);

  useEffect(() => {
    void fetchBalances();
    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchBalances();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return (
    <TopbarAppShell
      title="Dashboard"
      currentSection="dashboard"
      signOutAction={signOutAction}
      user={user}
    >
      <TopHero balances={balances} preferredNetwork={preferredNetwork} />

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <OnchainAssetsPanel
          balances={balances}
          preferredNetwork={preferredNetwork}
        />
        <aside className="space-y-5">
          <QuickDepositPanel
            starknetAddress={starknetAddress}
            walletDeployed={walletDeployed}
          />
        </aside>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PredictionMarketPanel />
        <aside className="space-y-5">
          <SecurityHealthPanel />
          <SearchUsersPanel />
        </aside>
      </div>

      <ActivityPanel />
    </TopbarAppShell>
  );
}

function DashboardHeader({ signOutAction, user }: DashboardViewProps) {
  return (
    <header className="border-b border-[#1a1d27] px-4 py-4 md:px-6 md:py-5">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3151ff] shadow-[0_10px_30px_rgba(49,81,255,0.28)] md:h-10 md:w-10 md:rounded-[11px]"
        >
          <Image
            src="/logo.png"
            alt="StarkFlow logo"
            width={18}
            height={18}
            className="h-[18px] w-auto object-contain"
          />
        </Link>

        <div className="text-center">
          <p className="[font-family:var(--font-syne)] text-[18px] font-semibold md:text-[20px]">
            Dashboard
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <HeaderIconButton label="Notifications">
            <BellIcon />
          </HeaderIconButton>
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-[10px] border border-[#232836] bg-[#10141d] text-[#dbe0ef] [&::-webkit-details-marker]:hidden md:h-10 md:w-10 md:rounded-[11px]">
              <MenuIcon />
            </summary>
            <HeaderMenu signOutAction={signOutAction} user={user} />
          </details>
        </div>
      </div>
    </header>
  );
}

function HeaderIconButton({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#232836] bg-[#10141d] text-[#dbe0ef] transition hover:border-[#31476b] md:h-10 md:w-10 md:rounded-[11px]"
    >
      {children}
    </button>
  );
}

function HeaderMenu({
  signOutAction,
  user,
}: Pick<DashboardViewProps, "signOutAction" | "user">) {
  return (
    <div className="absolute right-0 top-12 z-20 w-60 rounded-[16px] border border-[#262b38] bg-[#151922] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <p className="truncate text-[14px] font-semibold text-white">
        {user.name ?? "StarkFlow User"}
      </p>
      <p className="mt-1 truncate text-[12px] text-[#8a92a8]">
        {user.email ?? "Authenticated session"}
      </p>

      <div className="mt-4 border-t border-[#222735] pt-4">
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-between rounded-[12px] border border-[#2b3140] bg-[#1a1f2a] px-4 py-3 text-left text-[14px] font-medium text-white transition hover:border-[#3b5bff]"
          >
            Sign out
            <ArrowRightIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function TopHero({
  balances,
  preferredNetwork,
}: {
  balances: LiveBalances;
  preferredNetwork?: string;
}) {
  const networkLabel =
    preferredNetwork === "mainnet" ? "Mainnet" : "Sepolia Testnet";
  return (
    <section className="rounded-[22px] border border-[#1637c0] bg-[linear-gradient(135deg,#0a1d92_0%,#1328a7_48%,#13208a_100%)] px-6 py-6 shadow-[0_24px_70px_rgba(24,45,180,0.26)] md:px-8 md:py-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#b7c6ff]">
            Total Vault Balance
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <h2 className="[font-family:var(--font-syne)] text-[44px] leading-none tracking-[-0.05em] md:text-[58px]">
              {balances.strkbtc.split(" ")[0] ?? "0.0000"}
            </h2>
            <span className="pb-1 text-[18px] font-semibold text-[#a9baff]">
              strkBTC
            </span>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-[#94a9ff]">
            {networkLabel} · Gas Sponsored
          </p>
      <div className="mt-6 flex flex-wrap gap-3">
            <HeroActionButton href="/move?tab=bridge" tone="primary">
              Bridge BTC
            </HeroActionButton>
            <HeroActionButton href="/move?tab=swap">Swap Assets</HeroActionButton>
            <Link
              href="/move?tab=send"
              className="inline-flex items-center gap-2 px-3 py-3 text-[14px] font-semibold text-white"
            >
              <PlusIcon />
              Send Funds
            </Link>
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/6 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-[#c5d0ff]">
                Gas Saved (lifetime)
              </p>
              <p className="mt-2 [font-family:var(--font-syne)] text-[42px] leading-none tracking-[-0.04em]">
                0.00
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#2940c8] text-[#93a9ff]">
              <BoltIcon />
            </span>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[13px] text-[#c5d0ff]">
              Starts counting once sponsored Starknet activity settles onchain.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroActionButton({
  children,
  href,
  tone,
}: {
  children: ReactNode;
  href: string;
  tone?: "primary";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-[14px] px-5 py-4 text-[15px] font-semibold transition ${
        tone === "primary"
          ? "bg-[#3151ff] text-white shadow-[0_12px_34px_rgba(49,81,255,0.3)]"
          : "bg-white/10 text-white hover:bg-white/14"
      }`}
    >
      {tone === "primary" ? <ArrowUpRightIcon /> : <SwapIcon />}
      {children}
    </Link>
  );
}

function OnchainAssetsPanel({
  balances,
  preferredNetwork,
}: {
  balances: LiveBalances;
  preferredNetwork?: string;
}) {
  const networkLabel = preferredNetwork === "mainnet" ? "Mainnet" : "Testnet";

  // Merge live balances and inject the correct network label into the static asset list
  const liveAssets = onchainAssets.map((asset) => {
    const netLabel = asset.symbol === "BTC" ? "Standby" : networkLabel;
    if (asset.symbol === "STRK")
      return {
        ...asset,
        balance: balances.strk.split(" ")[0] ?? asset.balance,
        network: netLabel,
      };
    if (asset.symbol === "USDC")
      return {
        ...asset,
        balance: balances.usdc.split(" ")[0] ?? asset.balance,
        network: netLabel,
      };
    if (asset.symbol === "strkBTC")
      return {
        ...asset,
        balance: balances.strkbtc.split(" ")[0] ?? asset.balance,
        network: netLabel,
      };
    return { ...asset, network: netLabel };
  });

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[26px]">
          Your Assets
        </h3>
        <Link href="/move" className="text-[12px] font-semibold text-[#3b5bff]">
          View All <ArrowUpRightMini />
        </Link>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[#272c35] bg-[#1f232b]">
        <div className="hidden grid-cols-[minmax(0,1.35fr)_120px_140px_minmax(0,1fr)] gap-4 border-b border-[#2a303a] px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a0b4] md:grid">
          <span>Asset</span>
          <span>Network</span>
          <span>Balance</span>
          <span>State</span>
        </div>

        <div className="divide-y divide-[#2a303a]">
          {liveAssets.map((asset) => (
            <AssetRow key={asset.name} asset={asset as OnchainAsset} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AssetRow({ asset }: { asset: OnchainAsset }) {
  return (
    <>
      <div className="hidden grid-cols-[minmax(0,1.35fr)_120px_140px_minmax(0,1fr)] items-center gap-4 px-6 py-6 md:grid">
        <div className="flex items-center gap-4">
          <AssetBadge asset={asset} />
          <div>
            <p className="text-[16px] font-semibold text-white">{asset.name}</p>
            <p className="mt-1 text-[12px] text-[#9099ae]">{asset.symbol}</p>
          </div>
        </div>

        <p className="text-[14px] font-medium text-[#cfd4e3]">
          {asset.network}
        </p>
        <p className="[font-family:var(--font-syne)] text-[20px] leading-none">
          {asset.balance}
        </p>
        <p className="text-[13px] text-[#9099ae]">{asset.status}</p>
      </div>

      <div className="px-5 py-5 md:hidden">
        <div className="flex items-start gap-4">
          <AssetBadge asset={asset} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-white">
                  {asset.name}
                </p>
                <p className="mt-1 text-[12px] text-[#8f98ad]">
                  {asset.symbol} · {asset.network}
                </p>
              </div>
              <p className="[font-family:var(--font-syne)] text-[20px] leading-none">
                {asset.balance}
              </p>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-[#8f98ad]">
              {asset.status}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function AssetBadge({ asset }: { asset: OnchainAsset }) {
  const toneMap = {
    primary: "bg-[#2b43d5] text-white",
    secondary: "bg-[#12161d] text-[#eef1ff] border border-[#3a404d]",
    gold: "bg-[#8f5a13] text-[#ffe8b5]",
    neutral: "bg-[#2a2f3a] text-[#d7dceb]",
  } as const;

  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold ${toneMap[asset.tone]}`}
    >
      {asset.symbol.slice(0, 2)}
    </span>
  );
}

function QuickDepositPanel({
  starknetAddress,
  walletDeployed,
}: {
  starknetAddress?: string | null;
  walletDeployed?: boolean | null;
}) {
  const [copied, setCopied] = useState(false);

  const shortAddr = starknetAddress
    ? `${starknetAddress.slice(0, 8)}...${starknetAddress.slice(-6)}`
    : "Provisioning…";

  const handleCopy = () => {
    if (!starknetAddress) return;
    void navigator.clipboard.writeText(starknetAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1f232b] px-5 py-5">
      <h3 className="[font-family:var(--font-syne)] text-[20px] font-semibold">
        Quick Deposit
      </h3>
      <p className="mt-2 text-[14px] text-[#9ba3b7]">
        Scan or copy to fund your account
      </p>

      <DepositVisual />

      <div className="mt-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9ba3b7]">
          Your Starknet Address
        </p>
        <button
          type="button"
          onClick={handleCopy}
          title={starknetAddress ?? "Loading…"}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#343946] bg-[#181c24] px-4 py-4 transition hover:border-[#3151ff]"
        >
          <span className="truncate text-[14px] text-[#f1f3fb]">
            {shortAddr}
          </span>
          <span className="shrink-0 text-[12px] font-medium text-[#d9deeb]">
            {copied ? "Copied!" : <CopyIcon />}
          </span>
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/move?tab=swap"
          className="rounded-[12px] bg-black px-4 py-3 text-[14px] font-semibold text-white"
        >
          Swap Stable
        </Link>
        <Link
          href="/move?tab=bridge"
          className="rounded-[12px] bg-black px-4 py-3 text-[14px] font-semibold text-white"
        >
          Bridge BTC
        </Link>
      </div>
    </section>
  );
}

function DepositVisual() {
  return (
    <div className="mt-6 flex justify-center">
      <div className="relative h-[190px] w-[180px] overflow-hidden rounded-[18px] bg-[#f5f6fb] p-3">
        <div className="absolute left-4 top-6 h-[88px] w-[64px] rotate-[-12deg] rounded-[12px] bg-[linear-gradient(160deg,#1847ff,#4d86ff)]" />
        <div className="absolute left-14 top-9 h-[100px] w-[70px] rotate-[10deg] rounded-[12px] bg-[linear-gradient(180deg,#8d5c39,#66411f)]" />
        <div className="absolute right-4 top-6 h-[116px] w-[74px] rotate-[10deg] rounded-[16px] bg-white shadow-[0_18px_30px_rgba(31,36,52,0.18)]">
          <div className="absolute inset-x-3 top-3 h-4 rounded-full bg-[#0b111d]" />
          <div className="absolute inset-x-3 top-10 h-14 rounded-[10px] bg-[linear-gradient(180deg,#edf1fb,#dce5fa)]" />
          <div className="absolute bottom-6 left-1/2 h-8 w-8 -translate-x-1/2 rounded-[8px] border-2 border-[#0b111d]" />
        </div>
      </div>
    </div>
  );
}

function PredictionMarketPanel() {
  return (
    <section className="rounded-[20px] border border-[#103a56] bg-[linear-gradient(180deg,#081927,#0a1018)] px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#0b3550] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fd4ff]">
          Prediction Market
        </span>
        <span className="text-[12px] font-medium text-[#93c7ef]">
          Pragma Oracle
        </span>
      </div>

      <h3 className="mt-5 [font-family:var(--font-syne)] text-[28px] leading-tight md:text-[34px]">
        Will Bitcoin trade above $100k before this cycle closes?
      </h3>

      <p className="mt-3 max-w-[900px] text-[14px] leading-7 text-[#9eb7ca]">
        This card stays empty until the market module is live. The layout is
        ready, but odds, volume, and execution stay honest instead of faking
        activity.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Link
          href="/predict"
          className="h-12 rounded-[12px] bg-[#2dcf6c] text-[15px] font-bold text-black opacity-70"
        >
          YES
        </Link>
        <Link
          href="/predict"
          className="h-12 rounded-[12px] bg-[#f14e52] text-[15px] font-bold text-white opacity-70"
        >
          NO
        </Link>
      </div>

      <p className="mt-4 text-[12px] text-[#88b1cb]">
        One-click execution via Session Keys. No pop-ups.
      </p>
    </section>
  );
}

function SecurityHealthPanel() {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#272c35] bg-[#1f232b]">
      <div className="bg-[#111a5b] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[#7da0ff]">
            <ShieldIcon />
          </span>
          <p className="text-[16px] font-semibold text-white">
            Security Health
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#313644] px-5">
        <SecurityRow label="Session Key" value="Inactive" />
        <SecurityRow label="2FA Recovery" value="Not configured" />
      </div>
    </section>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <p className="text-[14px] text-[#dbe0ed]">{label}</p>
      <span className="rounded-full border border-[#3a404c] px-3 py-1 text-[12px] font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

function SearchUsersPanel() {
  return (
    <Link
      href="/move?tab=send"
      className="block rounded-[14px] border border-[#313644] bg-[#171b22] px-4 py-3 text-[#7d879b] transition hover:border-[#3151ff] hover:text-[#c7d2f0]"
    >
      Search users...
    </Link>
  );
}

function ActivityPanel() {
  return (
    <section className="mt-8">
      <h3 className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[26px]">
        Social Activity
      </h3>

      <div className="mt-4 overflow-hidden rounded-[20px] border border-[#272c35] bg-[#1f232b]">
        <div className="border-b border-[#2a303a] px-6 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#98a0b4]">
            Live Activity
          </p>
        </div>

        <div className="px-6 py-8">
          <div className="mx-auto max-w-[820px] text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#111726] text-[#6788ff]">
              <PulseIcon />
            </span>
            <p className="mt-4 [font-family:var(--font-syne)] text-[24px] leading-none">
              No verified activity yet
            </p>

            <div className="mt-4 space-y-2">
              {feedEmptyStates.map((line) => (
                <p key={line} className="text-[14px] leading-6 text-[#8b95ab]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#2a303a] px-6 py-4 text-center text-[13px] font-medium text-[#b9c1d6]">
          Load more activity
        </div>
      </div>
    </section>
  );
}

function BottomDock() {
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[84px] max-w-[460px] items-center justify-around border-x border-t border-[#231c59] bg-black/96 px-4 backdrop-blur md:hidden">
        {dashboardTabs.map((tab) => (
          <DockItem key={tab.label} tab={tab} mobile />
        ))}
      </nav>

      <nav className="hidden border-t border-[#171b24] px-6 py-4 md:flex md:items-center md:justify-center">
        <div className="flex w-full max-w-[980px] items-center justify-between gap-4">
          {dashboardTabs.map((tab) => (
            <DockItem key={tab.label} tab={tab} />
          ))}
        </div>
      </nav>
    </>
  );
}

function DockItem({ mobile, tab }: { tab: DashboardTab; mobile?: boolean }) {
  const iconColor = tab.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";
  const labelColor = tab.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";
  if (mobile) {
    return (
      <Link
        href={tab.href}
        className="flex flex-col items-center gap-1 text-[11px] font-medium"
      >
        <span
          className={`inline-flex h-9 w-9 items-center justify-center ${iconColor}`}
        >
          <DockIcon icon={tab.icon} />
        </span>
        <span className={labelColor}>{tab.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={tab.href}
      className={`flex min-w-[180px] flex-col items-center justify-center gap-2 rounded-[14px] px-4 py-2 text-[12px] font-semibold transition ${
        tab.active
          ? "border border-[#243ba4] bg-[#0d1220] text-[#3b5bff]"
          : "border border-transparent text-[#cfd5e3] hover:border-[#1d2330]"
      }`}
    >
      <span className={iconColor}>
        <DockIcon icon={tab.icon} />
      </span>
      <span className={labelColor}>{tab.label}</span>
    </Link>
  );
}

function DockIcon({ icon }: { icon: DashboardTab["icon"] }) {
  if (icon === "home") return <HomeIcon />;
  if (icon === "move") return <MoveIcon />;
  if (icon === "predict") return <PredictIcon />;
  return <UserIcon />;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5" fill="none">
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5" fill="none">
      <path
        d="M6 7h12M10 12h8M8 17h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M7 12h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M7 17 17 7m0 0H9m8 0v8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRightMini() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-3.5 w-3.5" fill="none">
      <path
        d="M8 16 16 8m0 0h-5m5 0v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 6v12M6 12h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="m13 3-7 9h4l-1 9 9-11h-5l1-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M8 7h9m0 0-3-3m3 3-3 3M16 17H7m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
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

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M3 12h4l2-4 4 8 2-4h6"
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6 15V7.2A2.2 2.2 0 0 1 8.2 5H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M4 12h10m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 5v14H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PredictIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 16 10 11l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 7h2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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
