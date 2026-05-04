"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthorizationSignature } from "@privy-io/react-auth";
import { CallData, cairo, shortString } from "starknet";
import { TopbarAppShell } from "@/components/app-shell/shell";
import { getMoveExecutionClient } from "@/lib/move-wallet-client";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import { getPredictEscrowConfig } from "@/lib/predict-escrow-config";
import { predictSteps } from "./predict-data";

type PredictViewProps = {
  getAccessToken: () => Promise<string | null>;
  identityToken: string | null;
  preferredNetwork: "mainnet" | "sepolia";
  signOutAction: () => Promise<void>;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

type PredictFeedItem = {
  body: string;
  time: string;
  title: string;
};

type PredictMarket = {
  category: string;
  currentPriceDisplay: string;
  currentPriceUsd: number | null;
  description: string;
  id: string;
  noProbability: number;
  onchainMarketId: string;
  priceSource: string;
  sourceUpdatedAt: string | null;
  state: string;
  targetPriceDisplay: string;
  targetPriceUsd: number;
  timeframe: string;
  title: string;
  totalBets: number;
  totalVolumeDisplay: string;
  yesProbability: number;
};

type PredictSavedBet = {
  createdAt: string;
  currentPrice: string | null;
  entryProbabilityBps: number | null;
  executionMode: string;
  id: string;
  marketCategory: string;
  marketId: string;
  marketTitle: string;
  onchainMarketId: string | null;
  outcome: "YES" | "NO";
  stakeAmount: string;
  stakeCurrency: string;
  status: string;
  targetPrice: string;
  txHash: string | null;
};

type PredictSummary = {
  activeHedges: number;
  activeHedgesDisplay: string;
  priceSources: string[];
  totalVolumeDisplay: string;
  totalVolumeUsd: number;
};

type PredictMarketsPayload = {
  feed: PredictFeedItem[];
  markets: PredictMarket[];
  myBets: PredictSavedBet[];
  network: "mainnet" | "sepolia";
  onchainExecutionLive: boolean;
  summary: PredictSummary;
};

type SubmitState =
  | { error: string; status: "error" }
  | { message: string; status: "success" }
  | null;

const stakeChoices = ["1", "5", "10"] as const;

async function fetchPredictJson<T>(
  getAccessToken: () => Promise<string | null>,
  identityToken: string | null,
  input: string,
  init?: RequestInit,
) {
  const token = await waitForPrivyAccessToken(getAccessToken);

  if (!token) {
    throw new Error("Privy access token was not ready");
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(identityToken ? { "x-privy-identity-token": identityToken } : {}),
    },
  });
  const rawBody = await response.text();
  const payload = (() => {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as T | { error?: string };
    } catch {
      return null;
    }
  })();

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? payload.error
        : rawBody?.trim() || "No error body returned.";

    throw new Error(
      `${input} failed with status ${response.status}: ${detail}`,
    );
  }

  return payload as T;
}

function shortStakeDisplay(stakeAmount: string, currency: string) {
  return `${stakeAmount} ${currency}`;
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function parseUsdcAmountToRaw(value: string) {
  const normalized = value.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Enter a valid USDC stake amount.");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  if (fractionalPart.length > 6) {
    throw new Error("USDC stake supports up to 6 decimal places.");
  }

  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionalPart + "000000").slice(0, 6));
  const raw = whole * BigInt(1_000_000) + fraction;

  if (raw <= BigInt(0)) {
    throw new Error("Enter a valid USDC stake amount.");
  }

  return raw;
}

function shortTimestamp(isoValue: string) {
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

export function PredictView({
  getAccessToken,
  identityToken,
  preferredNetwork,
  signOutAction,
  user,
}: PredictViewProps) {
  const searchParams = useSearchParams();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const [feed, setFeed] = useState<PredictFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<PredictMarket[]>([]);
  const [myBets, setMyBets] = useState<PredictSavedBet[]>([]);
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  const [onchainExecutionLive, setOnchainExecutionLive] = useState(false);
  const [stakeByMarket, setStakeByMarket] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>(null);
  const [summary, setSummary] = useState<PredictSummary>({
    activeHedges: 0,
    activeHedgesDisplay: "00",
    priceSources: [],
    totalVolumeDisplay: "$0.00",
    totalVolumeUsd: 0,
  });

  async function loadPredictState() {
    setLoading(true);

    try {
      const payload = await fetchPredictJson<PredictMarketsPayload>(
        getAccessToken,
        identityToken,
        "/api/predict/markets",
      );

      setFeed(payload.feed);
      setMarkets(payload.markets);
      setMyBets(payload.myBets);
      setOnchainExecutionLive(payload.onchainExecutionLive);
      setSummary(payload.summary);
      setStakeByMarket((current) => {
        const next = { ...current };

        for (const market of payload.markets) {
          if (!next[market.id]) {
            next[market.id] = "5";
          }
        }

        return next;
      });
    } catch (error) {
      setState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to load prediction markets.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPredictState();
  }, [getAccessToken, identityToken, preferredNetwork]);

  async function handlePlaceBet(market: PredictMarket, outcome: "YES" | "NO") {
    const stakeAmount = stakeByMarket[market.id] ?? "5";

    setPlacingKey(`${market.id}:${outcome}`);
    setState(null);

    try {
      if (onchainExecutionLive) {
        const escrowConfig = getPredictEscrowConfig();

        if (!escrowConfig) {
          throw new Error("Predict escrow is not configured in this build.");
        }

        const rawStakeAmount = parseUsdcAmountToRaw(stakeAmount);
        const execution = await getMoveExecutionClient({
          generateAuthorizationSignature,
          getAccessToken,
          identityToken,
          preferredNetwork,
        });

        await execution.wallet.ensureReady({
          deploy: "if_needed",
          ...(execution.session.sponsoredExecution
            ? { feeMode: "sponsored" as const }
            : {}),
        });

        const tx = await execution.wallet.execute(
          [
            {
              contractAddress: escrowConfig.collateralTokenAddress,
              entrypoint: "approve",
              calldata: CallData.compile({
                spender: escrowConfig.address,
                amount: cairo.uint256(rawStakeAmount),
              }),
            },
            {
              contractAddress: escrowConfig.address,
              entrypoint: "place_bet",
              calldata: CallData.compile({
                market_id: shortString.encodeShortString(market.onchainMarketId),
                side: outcome === "YES" ? 1 : 2,
                amount: cairo.uint256(rawStakeAmount),
              }),
            },
          ],
          execution.session.sponsoredExecution
            ? { feeMode: "sponsored" as const }
            : undefined,
        );

        const payload = await fetchPredictJson<{
          message: string;
        }>(getAccessToken, identityToken, "/api/predict/bets", {
          method: "POST",
          body: JSON.stringify({
            currentProbabilityBps:
              (outcome === "YES" ? market.yesProbability : market.noProbability) * 100,
            escrowAddress: escrowConfig.address,
            executionMode: "ONCHAIN",
            marketId: market.id,
            onchainMarketId: market.onchainMarketId,
            outcome,
            stakeAmount,
            txHash: tx.hash,
          }),
        });

        await loadPredictState();
        setState({
          status: "success",
          message: `${payload.message} Tx ${shortHash(tx.hash)}.`,
        });
        return;
      }

      const payload = await fetchPredictJson<{
        message: string;
      }>(getAccessToken, identityToken, "/api/predict/bets", {
        method: "POST",
        body: JSON.stringify({
          marketId: market.id,
          outcome,
          stakeAmount,
        }),
      });

      await loadPredictState();
      setState({
        status: "success",
        message: payload.message,
      });
    } catch (error) {
      setState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit prediction bet.",
      });
    } finally {
      setPlacingKey(null);
    }
  }

  const sourceLabel = useMemo(() => {
    if (summary.priceSources.length === 0) {
      return "Unavailable";
    }

    return summary.priceSources.join(" + ");
  }, [summary.priceSources]);

  const orderedMarkets = useMemo(() => {
    const selectedMarketId = searchParams.get("market");

    if (!selectedMarketId) {
      return markets;
    }

    const selectedMarket = markets.find((market) => market.id === selectedMarketId);

    if (!selectedMarket) {
      return markets;
    }

    return [
      selectedMarket,
      ...markets.filter((market) => market.id !== selectedMarketId),
    ];
  }, [markets, searchParams]);

  return (
    <TopbarAppShell
      title="Predict & Hedge"
      currentSection="predict"
      signOutAction={signOutAction}
      user={user}
    >
      <DesktopHero
        activeHedges={summary.activeHedgesDisplay}
        totalVolume={summary.totalVolumeDisplay}
      />
      <MobileSummary
        activeHedges={summary.activeHedgesDisplay}
        totalVolume={summary.totalVolumeDisplay}
      />

      <InlineState state={state} />

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-syne)] text-[24px] font-semibold text-white md:text-[30px]">
              Open Markets
            </h2>
            <p className="mt-1 hidden text-[14px] text-[#8e97ad] md:block">
              Submit live YES / NO hedges into the Sepolia escrow and keep the tx record visible in your position history.
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <FilterPill>{preferredNetwork === "mainnet" ? "Mainnet" : "Sepolia"}</FilterPill>
            <FilterPill>{sourceLabel}</FilterPill>
            <FilterPill>{onchainExecutionLive ? "Escrow live" : "Record only"}</FilterPill>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadPredictState();
            }}
            className="text-[12px] font-semibold text-[#4d72ff] md:hidden"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {loading ? (
              <LoadingPanel label="Loading live markets..." />
            ) : markets.length === 0 ? (
              <EmptyPanel label="No prediction markets are available right now." />
            ) : (
              orderedMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onPlaceBet={handlePlaceBet}
                  placingKey={placingKey}
                  setStakeAmount={(value) =>
                    setStakeByMarket((current) => ({
                      ...current,
                      [market.id]: value,
                    }))
                  }
                  stakeAmount={stakeByMarket[market.id] ?? "5"}
                />
              ))
            )}
          </div>

          <div className="space-y-4">
            <HowItWorksCard />
            <MyHedgesCard bets={myBets} />
            <GlobalFeedCard items={feed} />
            <TransparencyCard
              onchainExecutionLive={onchainExecutionLive}
              sourceLabel={sourceLabel}
            />
          </div>
        </div>
      </section>

      <MobileExecutionBar onchainExecutionLive={onchainExecutionLive} />
    </TopbarAppShell>
  );
}

function DesktopHero({
  activeHedges,
  totalVolume,
}: {
  activeHedges: string;
  totalVolume: string;
}) {
  return (
    <section className="hidden rounded-[24px] border border-[#2c3290] bg-[linear-gradient(135deg,#3a3a91_0%,#36378d_55%,#2e316f_100%)] px-8 py-8 md:block">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-[760px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#242e7d] px-3 py-2 text-[11px] font-semibold text-[#d5dcff]">
            <PulseDot />
            Live Market Insights
          </span>

          <h1 className="mt-5 [font-family:var(--font-syne)] text-[26px] font-semibold leading-[0.92] tracking-[-0.05em] text-white">
            Hedge Your Market Positions.
          </h1>

          <p className="mt-4 max-w-[620px] text-[16px] leading-7 text-[#d7dcff]">
            Put directional USDC hedges onchain, keep the tx hash visible, and monitor the position from Predict and Me.
          </p>

          <div className="mt-8 grid max-w-[460px] gap-7 sm:grid-cols-2">
            <HeroStat label="Market Volume" value={totalVolume} />
            <HeroStat label="My Open Hedges" value={activeHedges} />
          </div>
        </div>

        <div className="flex h-[170px] w-[240px] items-center justify-center">
          <TrendOutline />
        </div>
      </div>
    </section>
  );
}

function MobileSummary({
  activeHedges,
  totalVolume,
}: {
  activeHedges: string;
  totalVolume: string;
}) {
  return (
    <section className="md:hidden">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Market Volume" value={totalVolume} />
        <SummaryCard label="My Open Hedges" value={activeHedges} />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#22262f] bg-[#171b21] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d96ac]">
        {label}
      </p>
      <p className="mt-2 [font-family:var(--font-syne)] text-[28px] font-semibold leading-none text-white">
        {value}
      </p>
    </div>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7c1ff]">
        {label}
      </p>
      <p className="mt-2 [font-family:var(--font-syne)] text-[36px] font-semibold leading-none tracking-[-0.04em] text-white">
        {value}
      </p>
    </div>
  );
}

function MarketCard({
  market,
  onPlaceBet,
  placingKey,
  setStakeAmount,
  stakeAmount,
}: {
  market: PredictMarket;
  onPlaceBet: (market: PredictMarket, outcome: "YES" | "NO") => Promise<void>;
  placingKey: string | null;
  setStakeAmount: (value: string) => void;
  stakeAmount: string;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#282d37] bg-[#1b1f26]">
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f99b1]">
            <PragmaIcon />
            {market.category}
          </div>
          <span className="rounded-full bg-[#1b255e] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#89a2ff]">
            {market.timeframe}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_170px] md:items-center">
          <div>
            <h3 className="[font-family:var(--font-syne)] text-[24px] font-semibold leading-[1.02] text-white md:text-[28px]">
              {market.title}
            </h3>
            <p className="mt-3 max-w-[620px] text-[14px] leading-7 text-[#9aa3b6]">
              {market.description}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MarketMetric
                label="Current Price"
                value={market.currentPriceDisplay}
              />
              <MarketMetric
                label="Target"
                value={market.targetPriceDisplay}
              />
              <MarketMetric
                label="Tracked Volume"
                value={market.totalVolumeDisplay}
              />
            </div>

            <div className="mt-5 rounded-[12px] border border-[#222732] bg-[linear-gradient(180deg,#181c23,#14181f)] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c95aa]">
                    Market State
                  </p>
                  <p className="mt-2 [font-family:var(--font-syne)] text-[24px] font-semibold leading-none text-white">
                    {market.state}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c95aa]">
                    Price Source
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-[#bfc9ea]">
                    {market.priceSource}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[12px] border border-[#222732] bg-[#13171d] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FieldLabel>Stake Amount (USDC)</FieldLabel>
                <div className="flex gap-2">
                  {stakeChoices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setStakeAmount(choice)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                        stakeAmount === choice
                          ? "bg-[#3151ff] text-white"
                          : "bg-[#1d2230] text-[#adb6cc]"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>

              <input
                inputMode="decimal"
                value={stakeAmount}
                onChange={(event) => setStakeAmount(event.target.value)}
                placeholder="5"
                className="mt-3 h-11 w-full rounded-[12px] border border-[#2a303b] bg-black px-4 text-[14px] text-white outline-none placeholder:text-[#677086]"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <OutcomeButton
              active={placingKey === `${market.id}:YES`}
              probability={market.yesProbability}
              tone="yes"
              onClick={() => {
                void onPlaceBet(market, "YES");
              }}
            />
            <OutcomeButton
              active={placingKey === `${market.id}:NO`}
              probability={market.noProbability}
              tone="no"
              onClick={() => {
                void onPlaceBet(market, "NO");
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#282d37] px-4 py-3 text-[11px] text-[#8b94a9] md:px-5">
        <span>{market.totalBets} recorded bets on this market</span>
        <span>{market.sourceUpdatedAt ? `Updated ${shortTimestamp(market.sourceUpdatedAt)}` : "Awaiting source refresh"}</span>
      </div>
    </section>
  );
}

function MarketMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-[#222732] bg-[#14181f] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c95aa]">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-semibold text-white">{value}</p>
    </div>
  );
}

function OutcomeButton({
  active,
  onClick,
  probability,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  probability: number;
  tone: "yes" | "no";
}) {
  const isYes = tone === "yes";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`flex h-[64px] w-full flex-col items-center justify-center rounded-[14px] text-center ${
        isYes ? "bg-[#25c980] text-white" : "bg-[#f05454] text-white"
      } disabled:opacity-70`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
        {active ? "Saving..." : isYes ? "Bet Yes" : "Bet No"}
      </span>
      <span className="[font-family:var(--font-syne)] mt-1 text-[26px] font-semibold leading-none">
        {probability}%
      </span>
    </button>
  );
}

function HowItWorksCard() {
  return (
    <section className="rounded-[20px] bg-[#07103b] px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[#6185ff]">
          <InfoIcon />
        </span>
        <p className="text-[15px] font-semibold text-white">How It Works</p>
      </div>

      <div className="mt-5 space-y-4">
        {predictSteps.map((step) => (
          <div key={step.number} className="flex gap-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3151ff] text-[12px] font-bold text-white">
              {step.number}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-[13px] leading-6 text-[#96a1c6]">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MyHedgesCard({ bets }: { bets: PredictSavedBet[] }) {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#6185ff]">
            <PredictShieldIcon />
          </span>
          <p className="text-[15px] font-semibold text-white">My Hedges</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d96ac]">
          Tracked
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {bets.length === 0 ? (
          <p className="text-[12px] leading-6 text-[#9099ad]">
            No prediction hedges yet. Submit your first YES or NO position to start the book.
          </p>
        ) : (
          bets.slice(0, 6).map((bet) => (
            <div
              key={bet.id}
              className="rounded-[14px] border border-[#2b303b] bg-[#14181f] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {bet.marketTitle}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#9099ad]">
                    {bet.outcome} with {shortStakeDisplay(bet.stakeAmount, bet.stakeCurrency)} -{" "}
                    {bet.executionMode === "ONCHAIN" ? "Onchain escrow" : "Record only"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    bet.outcome === "YES"
                      ? "bg-[#133927] text-[#7fe0af]"
                      : "bg-[#421d1d] text-[#ff9f9f]"
                  }`}
                >
                  {bet.outcome}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-[#7e889d]">
                Target {bet.targetPrice} • Recorded {shortTimestamp(bet.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function GlobalFeedCard({ items }: { items: PredictFeedItem[] }) {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1a1e25] px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#6185ff]">
            <InfoIcon />
          </span>
          <p className="text-[15px] font-semibold text-white">Global Feed</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d96ac]">
          Live
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-[12px] leading-6 text-[#9099ad]">
            No prediction activity has been recorded yet.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={`${item.title}:${item.time}:${item.body}`}
              className="rounded-[14px] border border-[#2b303b] bg-[#14181f] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#9099ad]">
                    {item.body}
                  </p>
                </div>
                <span className="text-[11px] text-[#7e889d]">{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TransparencyCard({
  onchainExecutionLive,
  sourceLabel,
}: {
  onchainExecutionLive: boolean;
  sourceLabel: string;
}) {
  return (
    <section className="rounded-[20px] bg-[linear-gradient(180deg,#171b22,#11151b)] px-5 py-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#62a6ff]">
        Transparency
      </span>
      <h3 className="mt-4 [font-family:var(--font-syne)] text-[26px] font-semibold leading-[1.02] text-white">
        Price feeds and bet records stay explicit
      </h3>
      <p className="mt-4 text-[14px] leading-7 text-[#97a0b5]">
        Live prices are sourced from {sourceLabel}. When escrow is live on Sepolia, StarkFlow submits the approval and bet transaction onchain, then stores the tx hash and price snapshot in your profile history.
      </p>
      <button
        type="button"
        className="mt-5 text-[13px] font-semibold text-[#3b5bff]"
      >
        {onchainExecutionLive ? "Sepolia escrow active" : "Record-only fallback active"}
      </button>
    </section>
  );
}

function MobileExecutionBar({
  onchainExecutionLive,
}: {
  onchainExecutionLive: boolean;
}) {
  return (
    <section className="mt-5 rounded-[18px] border border-[#1b2457] bg-[#101840] px-4 py-4 md:hidden">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2d79] text-[#87a0ff]">
          <PredictShieldIcon />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-[#9fb2ff]">
            {onchainExecutionLive ? "Escrow execution enabled" : "Prediction recording only"}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#8697cf]">
            {onchainExecutionLive
              ? "YES and NO bets route through the live Sepolia escrow and save the tx hash locally."
              : "This build can still record the prediction locally if the live escrow is unavailable."}
          </p>
        </div>
      </div>
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="rounded-[20px] border border-[#282d37] bg-[#1b1f26] px-5 py-10 text-center text-[14px] text-[#96a0b6]">
      {label}
    </section>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <section className="rounded-[20px] border border-[#282d37] bg-[#1b1f26] px-5 py-10 text-center text-[14px] text-[#96a0b6]">
      {label}
    </section>
  );
}

function InlineState({ state }: { state: SubmitState }) {
  if (!state) {
    return null;
  }

  return (
    <div
      className={`mt-5 rounded-[14px] border px-4 py-3 text-[13px] ${
        state.status === "success"
          ? "border-[#204b34] bg-[#0f1f17] text-[#9de0ba]"
          : "border-[#5e2626] bg-[#241313] text-[#ffb4b4]"
      }`}
    >
      {state.status === "success" ? state.message : state.error}
    </div>
  );
}

function FilterPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#151920] px-3 py-1.5 text-[11px] font-semibold text-[#c6cede]">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f99af]">
      {children}
    </p>
  );
}

function PulseDot() {
  return <span className="h-2 w-2 rounded-full bg-[#9db0ff]" />;
}

function TrendOutline() {
  return (
    <svg viewBox="0 0 220 160" className="h-full w-full text-white/10" fill="none">
      <path
        d="M30 115 94 51l34 33 56-57"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M157 27h31v31"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PragmaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 4.5V7m0 10v2.5M4.5 12H7m10 0h2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 11v4m0-7h.01"
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
