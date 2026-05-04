import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import {
  accountLinks,
  legalLinks,
  preferenceLinks,
  resources,
  supportLinks,
} from "./me-data";

type MeViewProps = {
  getAccessToken: () => Promise<string | null>;
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

type MePredictionPosition = {
  createdAt: string;
  currentMarkValue: string;
  currentPriceDisplay: string;
  currentProbability: number;
  direction: "flat" | "gaining" | "losing";
  entryProbability: number;
  executionMode: string;
  id: string;
  marketCategory: string;
  marketId: string;
  marketTitle: string;
  onchainMarketId: string | null;
  outcome: "YES" | "NO";
  potentialPayout: string;
  potentialProfit: string;
  stakeAmount: string;
  stakeCurrency: string;
  status: string;
  targetPriceDisplay: string;
  txHash: string | null;
  unrealizedPnl: string;
};

type MeDcaStrategy = {
  buyTokenSymbol: string;
  createdAt: string;
  frequency: string;
  id: string;
  orderAddress: string | null;
  providerId: string;
  sellAmount: string;
  sellPerCycle: string;
  sellTokenSymbol: string;
  status: string;
  strategyId: string;
  txHash: string | null;
};

type MeYieldPosition = {
  canWithdraw: boolean;
  collateralAmount: string;
  collateralTokenAddress: string;
  collateralTokenDecimals: number;
  collateralSymbol: string;
  collateralUsdValue: string | null;
  debtAmount: string | null;
  debtSymbol: string | null;
  debtUsdValue: string | null;
  pool: string;
  poolId: string;
  type: string;
};

type MePortfolioSummary = {
  activeDcaCount: number;
  openPredictionCount: number;
  totalPredictionStake: string;
  totalPredictionUnrealizedPnl: string;
  yieldPositionCount: number;
};

type MePortfolioPayload = {
  dcaStrategies: MeDcaStrategy[];
  predictionPositions: MePredictionPosition[];
  summary: MePortfolioSummary;
  yieldError: string | null;
  yieldPositions: MeYieldPosition[];
};

type ManagedActionState =
  | { message: string; status: "success" }
  | { error: string; status: "error" }
  | null;

async function fetchMePortfolio(
  getAccessToken: () => Promise<string | null>,
) {
  const token = await waitForPrivyAccessToken(getAccessToken);

  if (!token) {
    throw new Error("Privy access token was not ready");
  }

  const response = await fetch("/api/me/portfolio", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | MePortfolioPayload
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? payload.error
        : "Failed to load managed positions.",
    );
  }

  return payload as MePortfolioPayload;
}

async function runManagedPositionAction(
  getAccessToken: () => Promise<string | null>,
  body:
    | { kind: "prediction"; positionId: string }
    | { kind: "dca"; positionId: string }
    | {
        collateralTokenAddress: string;
        collateralTokenDecimals: number;
        collateralTokenSymbol: string;
        kind: "yield";
        poolId: string;
        positionType: string;
      },
) {
  const token = await waitForPrivyAccessToken(getAccessToken);

  if (!token) {
    throw new Error("Privy access token was not ready");
  }

  const response = await fetch("/api/me/positions", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; txHash?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Managed position action failed.");
  }

  return payload;
}

function shortRelativeTime(isoValue: string) {
  const createdAt = new Date(isoValue);
  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function frequencyLabel(value: string) {
  if (value === "PT1H") return "Hourly";
  if (value === "PT6H") return "Every 6h";
  if (value === "P1D") return "Daily";
  if (value === "P1W") return "Weekly";
  return value;
}

export function MeView({
  getAccessToken,
  signOutAction,
  updatePreferredNetworkAction,
  user,
}: MeViewProps) {
  const [portfolio, setPortfolio] = useState<MePortfolioPayload | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [managedActionState, setManagedActionState] = useState<ManagedActionState>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const username = user.username?.trim() || "stark-user";
  const handle = `@${username}.stark`;
  const profileName = handle;
  const shortAddress = user.starknetAddress
    ? `${user.starknetAddress.slice(0, 8)}...${user.starknetAddress.slice(-6)}`
    : "No wallet linked";
  const activeNetwork =
    user.preferredNetwork === "sepolia" ? "Sepolia Side" : "Mainnet Side";
  const summary = portfolio?.summary ?? {
    activeDcaCount: 0,
    openPredictionCount: 0,
    totalPredictionStake: "$0.00",
    totalPredictionUnrealizedPnl: "$0.00",
    yieldPositionCount: 0,
  };
  const quickStats = useMemo(
    () => [
      { label: "Prediction P/L", value: summary.totalPredictionUnrealizedPnl },
      { label: "Open Hedges", value: String(summary.openPredictionCount) },
      { label: "Active DCA", value: String(summary.activeDcaCount) },
      { label: "Yield Positions", value: String(summary.yieldPositionCount) },
    ],
    [summary],
  );
  const personalStats = useMemo(
    () => [
      {
        accent: summary.totalPredictionStake,
        label: "Prediction P/L",
        value: summary.totalPredictionUnrealizedPnl,
      },
      {
        accent: `${summary.activeDcaCount} DCA · ${summary.yieldPositionCount} yield`,
        label: "Managed Positions",
        value: String(
          summary.openPredictionCount + summary.activeDcaCount + summary.yieldPositionCount,
        ),
      },
    ],
    [summary],
  );

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const payload = await fetchMePortfolio(getAccessToken);
      setPortfolio(payload);
    } catch (error) {
      setPortfolioError(
        error instanceof Error
          ? error.message
          : "Failed to load managed positions.",
      );
    } finally {
      setPortfolioLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio, user.preferredNetwork, user.starknetAddress]);

  const handleManagedAction = useCallback(
    async (
      actionKey: string,
      options:
        | {
            confirmMessage: string;
            request: { kind: "prediction"; positionId: string };
          }
        | {
            confirmMessage: string;
            request: { kind: "dca"; positionId: string };
          }
        | {
            confirmMessage: string;
            request: {
              collateralTokenAddress: string;
              collateralTokenDecimals: number;
              collateralTokenSymbol: string;
              kind: "yield";
              poolId: string;
              positionType: string;
            };
          },
    ) => {
      if (!window.confirm(options.confirmMessage)) {
        return;
      }

      setPendingActionKey(actionKey);
      setManagedActionState(null);

      try {
        const result = await runManagedPositionAction(getAccessToken, options.request);
        await loadPortfolio();
        setManagedActionState({
          status: "success",
          message:
            result?.txHash != null
              ? `${result.message ?? "Position updated."} Tx ${result.txHash.slice(0, 8)}...${result.txHash.slice(-6)}.`
              : result?.message ?? "Position updated.",
        });
      } catch (error) {
        setManagedActionState({
          status: "error",
          error:
            error instanceof Error ? error.message : "Managed position action failed.",
        });
      } finally {
        setPendingActionKey(null);
      }
    },
    [getAccessToken, loadPortfolio],
  );

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
        dcaStrategies={portfolio?.dcaStrategies ?? []}
        managedActionState={managedActionState}
        onManagedAction={handleManagedAction}
        pendingActionKey={pendingActionKey}
        personalStats={personalStats}
        portfolioError={portfolioError}
        portfolioLoading={portfolioLoading}
        predictionPositions={portfolio?.predictionPositions ?? []}
        quickStats={quickStats}
        yieldError={portfolio?.yieldError ?? null}
        yieldPositions={portfolio?.yieldPositions ?? []}
      />

      <MobilePersonalHub
        handle={handle}
        profileName={profileName}
        shortAddress={shortAddress}
        signOutAction={signOutAction}
        updatePreferredNetworkAction={updatePreferredNetworkAction}
        user={user}
        activeNetwork={activeNetwork}
        dcaStrategies={portfolio?.dcaStrategies ?? []}
        managedActionState={managedActionState}
        onManagedAction={handleManagedAction}
        pendingActionKey={pendingActionKey}
        personalStats={personalStats}
        portfolioError={portfolioError}
        portfolioLoading={portfolioLoading}
        predictionPositions={portfolio?.predictionPositions ?? []}
        yieldError={portfolio?.yieldError ?? null}
        yieldPositions={portfolio?.yieldPositions ?? []}
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
  dcaStrategies,
  managedActionState,
  onManagedAction,
  pendingActionKey,
  personalStats,
  portfolioError,
  portfolioLoading,
  predictionPositions,
  quickStats,
  yieldError,
  yieldPositions,
}: {
  profileName: string;
  handle: string;
  shortAddress: string;
  signOutAction: () => Promise<void>;
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  user: MeViewProps["user"];
  activeNetwork: string;
  dcaStrategies: MeDcaStrategy[];
  managedActionState: ManagedActionState;
  onManagedAction: (
    actionKey: string,
    options:
      | {
          confirmMessage: string;
          request: { kind: "prediction"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: { kind: "dca"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: {
            collateralTokenAddress: string;
            collateralTokenDecimals: number;
            collateralTokenSymbol: string;
            kind: "yield";
            poolId: string;
            positionType: string;
          };
        },
  ) => Promise<void>;
  pendingActionKey: string | null;
  personalStats: { accent: string; label: string; value: string }[];
  portfolioError: string | null;
  portfolioLoading: boolean;
  predictionPositions: MePredictionPosition[];
  quickStats: { label: string; value: string }[];
  yieldError: string | null;
  yieldPositions: MeYieldPosition[];
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
          <ManagedPositionsPanel
            dcaStrategies={dcaStrategies}
            managedActionState={managedActionState}
            onManagedAction={onManagedAction}
            pendingActionKey={pendingActionKey}
            portfolioError={portfolioError}
            portfolioLoading={portfolioLoading}
            predictionPositions={predictionPositions}
            yieldError={yieldError}
            yieldPositions={yieldPositions}
          />
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
  dcaStrategies,
  managedActionState,
  onManagedAction,
  pendingActionKey,
  personalStats,
  portfolioError,
  portfolioLoading,
  predictionPositions,
  yieldError,
  yieldPositions,
}: {
  profileName: string;
  handle: string;
  shortAddress: string;
  signOutAction: () => Promise<void>;
  updatePreferredNetworkAction: (formData: FormData) => Promise<void>;
  user: MeViewProps["user"];
  activeNetwork: string;
  dcaStrategies: MeDcaStrategy[];
  managedActionState: ManagedActionState;
  onManagedAction: (
    actionKey: string,
    options:
      | {
          confirmMessage: string;
          request: { kind: "prediction"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: { kind: "dca"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: {
            collateralTokenAddress: string;
            collateralTokenDecimals: number;
            collateralTokenSymbol: string;
            kind: "yield";
            poolId: string;
            positionType: string;
          };
        },
  ) => Promise<void>;
  pendingActionKey: string | null;
  personalStats: { accent: string; label: string; value: string }[];
  portfolioError: string | null;
  portfolioLoading: boolean;
  predictionPositions: MePredictionPosition[];
  yieldError: string | null;
  yieldPositions: MeYieldPosition[];
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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <PredictShieldIcon />
            </span>
            <p className="text-[15px] font-semibold text-white">Managed Positions</p>
          </div>
          <span className="rounded-full bg-[#1c275d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9db0ff]">
            Live
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-6 text-[#98a4d3]">
          Track open prediction edges, active DCA plans, and yield positions from one place.
        </p>
      </section>

      <div className="mt-4">
        <ManagedPositionsPanel
          compact
          dcaStrategies={dcaStrategies}
          managedActionState={managedActionState}
          onManagedAction={onManagedAction}
          pendingActionKey={pendingActionKey}
          portfolioError={portfolioError}
          portfolioLoading={portfolioLoading}
          predictionPositions={predictionPositions}
          yieldError={yieldError}
          yieldPositions={yieldPositions}
        />
      </div>

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

function ManagedPositionsPanel({
  compact,
  dcaStrategies,
  managedActionState,
  onManagedAction,
  pendingActionKey,
  portfolioError,
  portfolioLoading,
  predictionPositions,
  yieldError,
  yieldPositions,
}: {
  compact?: boolean;
  dcaStrategies: MeDcaStrategy[];
  managedActionState: ManagedActionState;
  onManagedAction: (
    actionKey: string,
    options:
      | {
          confirmMessage: string;
          request: { kind: "prediction"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: { kind: "dca"; positionId: string };
        }
      | {
          confirmMessage: string;
          request: {
            collateralTokenAddress: string;
            collateralTokenDecimals: number;
            collateralTokenSymbol: string;
            kind: "yield";
            poolId: string;
            positionType: string;
          };
        },
  ) => Promise<void>;
  pendingActionKey: string | null;
  portfolioError: string | null;
  portfolioLoading: boolean;
  predictionPositions: MePredictionPosition[];
  yieldError: string | null;
  yieldPositions: MeYieldPosition[];
}) {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#5c7eff]">
            <PredictShieldIcon />
          </span>
          <h2 className="[font-family:var(--font-syne)] text-[24px] font-semibold text-white md:text-[28px]">
            Managed Positions
          </h2>
        </div>
        <span className="rounded-full bg-[#202636] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#aeb9d6]">
          Live
        </span>
      </div>

      {portfolioError ? (
        <div className="mt-5 rounded-[14px] border border-[#5e2626] bg-[#241313] px-4 py-3 text-[13px] text-[#ffb4b4]">
          {portfolioError}
        </div>
      ) : null}

      {managedActionState ? (
        <div
          className={`mt-5 rounded-[14px] border px-4 py-3 text-[13px] ${
            managedActionState.status === "success"
              ? "border-[#204b34] bg-[#0f1f17] text-[#9de0ba]"
              : "border-[#5e2626] bg-[#241313] text-[#ffb4b4]"
          }`}
        >
          {managedActionState.status === "success"
            ? managedActionState.message
            : managedActionState.error}
        </div>
      ) : null}

      {portfolioLoading ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
            <div className="h-3 w-24 bg-[#272c35] rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 bg-[#272c35] rounded animate-pulse mb-1"></div>
                      <div className="h-3 w-3/4 bg-[#272c35] rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-16 bg-[#272c35] rounded-full animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
            <div className="h-3 w-20 bg-[#272c35] rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 bg-[#272c35] rounded animate-pulse mb-1"></div>
                      <div className="h-3 w-2/3 bg-[#272c35] rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-12 bg-[#272c35] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
            <div className="h-3 w-16 bg-[#272c35] rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 bg-[#272c35] rounded animate-pulse mb-1"></div>
                      <div className="h-3 w-1/2 bg-[#272c35] rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-14 bg-[#272c35] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`mt-5 grid gap-4 ${compact ? "" : "xl:grid-cols-3"}`}>
          <PredictionPositionsCard
            onManagedAction={onManagedAction}
            pendingActionKey={pendingActionKey}
            positions={predictionPositions}
          />
          <DcaStrategiesCard
            onManagedAction={onManagedAction}
            pendingActionKey={pendingActionKey}
            strategies={dcaStrategies}
          />
          <YieldPositionsCard
            error={yieldError}
            onManagedAction={onManagedAction}
            pendingActionKey={pendingActionKey}
            positions={yieldPositions}
          />
        </div>
      )}
    </section>
  );
}

function PredictionPositionsCard({
  onManagedAction,
  pendingActionKey,
  positions,
}: {
  onManagedAction: (
    actionKey: string,
    options: {
      confirmMessage: string;
      request: { kind: "prediction"; positionId: string };
    },
  ) => Promise<void>;
  pendingActionKey: string | null;
  positions: MePredictionPosition[];
}) {
  return (
    <section className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
        Prediction Book
      </p>
      <div className="mt-4 space-y-3">
        {positions.length === 0 ? (
          <p className="text-[12px] leading-6 text-[#8e97aa]">
            No prediction positions yet.
          </p>
        ) : (
          positions.slice(0, 5).map((position) => (
            <div
              key={position.id}
              className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">
                    {position.marketTitle}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8e97aa]">
                    {position.outcome} · {position.stakeAmount} {position.stakeCurrency}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    position.direction === "gaining"
                      ? "bg-[#123523] text-[#7ce2ad]"
                      : position.direction === "losing"
                        ? "bg-[#3d1b1b] text-[#ffabab]"
                        : "bg-[#232836] text-[#c1c8d8]"
                  }`}
                >
                  {position.direction}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniMetric label="Unrealized P/L" value={position.unrealizedPnl} />
                <MiniMetric label="Marked Value" value={position.currentMarkValue} />
                <MiniMetric
                  label="Current Odds"
                  value={`${position.currentProbability}%`}
                />
                <MiniMetric label="Potential Profit" value={position.potentialProfit} />
              </div>

              <p className="mt-3 text-[11px] text-[#7d8699]">
                Target {position.targetPriceDisplay} · Entry {position.entryProbability}% · Logged{" "}
                {shortRelativeTime(position.createdAt)}
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8e97aa]">
                  {position.status} · {position.executionMode}
                </span>
                {position.status === "OPEN" && position.executionMode !== "ONCHAIN" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onManagedAction(`prediction:${position.id}`, {
                        confirmMessage: "Do you want to cancel this prediction?",
                        request: {
                          kind: "prediction",
                          positionId: position.id,
                        },
                      });
                    }}
                    disabled={pendingActionKey === `prediction:${position.id}`}
                    className="rounded-[10px] border border-[#3b4050] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-[#ff7c7c] disabled:opacity-60"
                  >
                    {pendingActionKey === `prediction:${position.id}`
                      ? "Cancelling..."
                      : "Cancel"}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#7d8699]">
                    {position.executionMode === "ONCHAIN"
                      ? "Locked onchain"
                      : "No action"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DcaStrategiesCard({
  onManagedAction,
  pendingActionKey,
  strategies,
}: {
  onManagedAction: (
    actionKey: string,
    options: {
      confirmMessage: string;
      request: { kind: "dca"; positionId: string };
    },
  ) => Promise<void>;
  pendingActionKey: string | null;
  strategies: MeDcaStrategy[];
}) {
  return (
    <section className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
        DCA Strategies
      </p>
      <div className="mt-4 space-y-3">
        {strategies.length === 0 ? (
          <p className="text-[12px] leading-6 text-[#8e97aa]">
            No DCA strategies created yet.
          </p>
        ) : (
          strategies.slice(0, 5).map((strategy) => (
            <div
              key={strategy.id}
              className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">
                    {strategy.sellTokenSymbol} → {strategy.buyTokenSymbol}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8e97aa]">
                    {strategy.sellPerCycle} every {frequencyLabel(strategy.frequency)}
                  </p>
                </div>
                <span className="rounded-full bg-[#202636] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b7c2dc]">
                  {strategy.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniMetric label="Budget" value={strategy.sellAmount} />
                <MiniMetric label="Frequency" value={frequencyLabel(strategy.frequency)} />
              </div>

              <p className="mt-3 text-[11px] text-[#7d8699]">
                Provider {strategy.providerId} · Logged {shortRelativeTime(strategy.createdAt)}
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all text-[11px] text-[#7d8699]">
                  {strategy.orderAddress ? shortHash(strategy.orderAddress) : "No order address"}
                </span>
                {strategy.status !== "CLOSED" && strategy.orderAddress ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onManagedAction(`dca:${strategy.id}`, {
                        confirmMessage: "Do you want to cancel this DCA strategy?",
                        request: {
                          kind: "dca",
                          positionId: strategy.id,
                        },
                      });
                    }}
                    disabled={pendingActionKey === `dca:${strategy.id}`}
                    className="rounded-[10px] border border-[#3b4050] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-[#ff7c7c] disabled:opacity-60"
                  >
                    {pendingActionKey === `dca:${strategy.id}`
                      ? "Cancelling..."
                      : "Cancel"}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#7d8699]">Closed</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function YieldPositionsCard({
  error,
  onManagedAction,
  pendingActionKey,
  positions,
}: {
  error: string | null;
  onManagedAction: (
    actionKey: string,
    options: {
      confirmMessage: string;
      request: {
        collateralTokenAddress: string;
        collateralTokenDecimals: number;
        collateralTokenSymbol: string;
        kind: "yield";
        poolId: string;
        positionType: string;
      };
    },
  ) => Promise<void>;
  pendingActionKey: string | null;
  positions: MeYieldPosition[];
}) {
  return (
    <section className="rounded-[16px] border border-[#272c35] bg-[#14181f] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
        Yield Positions
      </p>
      <div className="mt-4 space-y-3">
        {error ? (
          <p className="text-[12px] leading-6 text-[#ffb4b4]">{error}</p>
        ) : positions.length === 0 ? (
          <p className="text-[12px] leading-6 text-[#8e97aa]">
            No live yield positions found.
          </p>
        ) : (
          positions.slice(0, 5).map((position, index) => (
            <div
              key={`${position.poolId}:${position.collateralTokenAddress}:${index}`}
              className="rounded-[14px] border border-[#232834] bg-[#1b2029] px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">{position.pool}</p>
                  <p className="mt-1 text-[12px] text-[#8e97aa]">
                    {position.type}
                  </p>
                </div>
                <span className="rounded-full bg-[#132a46] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#97c2ff]">
                  Live
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniMetric
                  label="Collateral"
                  value={`${position.collateralAmount}`}
                />
                <MiniMetric
                  label="Collateral USD"
                  value={position.collateralUsdValue ?? "Unavailable"}
                />
                <MiniMetric
                  label="Debt"
                  value={
                    position.debtAmount && position.debtSymbol
                      ? `${position.debtAmount}`
                      : "None"
                  }
                />
                <MiniMetric
                  label="Debt USD"
                  value={position.debtUsdValue ?? "None"}
                />
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words text-[11px] text-[#7d8699]">
                  {position.type === "earn" ? "Withdraw available" : "Repay required"}
                </span>
                {position.canWithdraw ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onManagedAction(`yield:${position.poolId}:${position.collateralTokenAddress}`, {
                        confirmMessage: "Do you want to withdraw this yield position?",
                        request: {
                          collateralTokenAddress: position.collateralTokenAddress,
                          collateralTokenDecimals: position.collateralTokenDecimals,
                          collateralTokenSymbol: position.collateralSymbol,
                          kind: "yield",
                          poolId: position.poolId,
                          positionType: position.type,
                        },
                      });
                    }}
                    disabled={
                      pendingActionKey ===
                      `yield:${position.poolId}:${position.collateralTokenAddress}`
                    }
                    className="rounded-[10px] border border-[#3b4050] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-[#7cb1ff] disabled:opacity-60"
                  >
                    {pendingActionKey ===
                    `yield:${position.poolId}:${position.collateralTokenAddress}`
                      ? "Withdrawing..."
                      : "Withdraw"}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#7d8699]">Manage in Move</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#232834] bg-[#151920] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
        {label}
      </p>
      <p className="mt-2 break-words text-[13px] font-semibold text-white">{value}</p>
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

function PredictShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 3 18 5.5V11c0 4.2-2.6 7.3-6 8.9C8.6 18.3 6 15.2 6 11V5.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.5 11 14l3.5-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

