import type { ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import {
  globalFeedItems,
  marketCards,
  mobilePredictSummary,
  predictSteps,
} from "./predict-data";

type PredictViewProps = {
  signOutAction: () => Promise<void>;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export function PredictView({ signOutAction, user }: PredictViewProps) {
  return (
    <TopbarAppShell
      title="Predict & Hedge"
      currentSection="predict"
      signOutAction={signOutAction}
      user={user}
    >
      <DesktopHero />
      <MobileSummary />

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-syne)] text-[24px] font-semibold text-white md:text-[30px]">
              Open Markets
            </h2>
            <p className="mt-1 hidden text-[14px] text-[#8e97ad] md:block">
              Human-readable hedges with session-key execution rails.
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <FilterPill>Gas</FilterPill>
            <FilterPill>Crypto</FilterPill>
            <FilterPill>Ecosystem</FilterPill>
          </div>

          <button
            type="button"
            className="text-[12px] font-semibold text-[#4d72ff] md:hidden"
          >
            Sort by Edge
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {marketCards.map((market) => (
              <MarketCard key={market.title} market={market} />
            ))}

            <button
              type="button"
              className="flex h-12 w-full items-center justify-center rounded-[14px] border border-[#313643] bg-transparent text-[14px] font-semibold text-[#d7ddef]"
            >
              Load More Markets
            </button>
          </div>

          <div className="space-y-4">
            <HowItWorksCard />
            <GlobalFeedCard />
            <TransparencyCard />
          </div>
        </div>
      </section>

      <MobileExecutionBar />
    </TopbarAppShell>
  );
}

function DesktopHero() {
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
            Gasless social prediction markets on Starknet. Protect transaction
            costs or trade macro events with readable outcomes before live rails
            are connected.
          </p>

          <div className="mt-8 grid max-w-[460px] gap-7 sm:grid-cols-2">
            <HeroStat label="Total Volume" value="$0.00" />
            <HeroStat label="Open Interest" value="$0.00" />
          </div>
        </div>

        <div className="flex h-[170px] w-[240px] items-center justify-center">
          <TrendOutline />
        </div>
      </div>
    </section>
  );
}

function MobileSummary() {
  return (
    <section className="md:hidden">
      <div className="grid grid-cols-2 gap-3">
        {mobilePredictSummary.map((item) => (
          <div
            key={item.label}
            className="rounded-[16px] border border-[#22262f] bg-[#171b21] px-4 py-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d96ac]">
              {item.label}
            </p>
            <p className="mt-2 [font-family:var(--font-syne)] text-[28px] font-semibold leading-none text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
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
}: {
  market: (typeof marketCards)[number];
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

            <div className="mt-5 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c95aa]">
                  Market State
                </p>
                <p className="mt-2 [font-family:var(--font-syne)] text-[28px] font-semibold leading-none text-white">
                  {market.state}
                </p>
              </div>

              <div className="h-[54px] rounded-[12px] border border-[#222732] bg-[linear-gradient(180deg,#181c23,#14181f)]">
                <div className="flex h-full items-center justify-center text-[11px] font-medium text-[#7f88a1]">
                  Oracle curve unlocks with live data
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <OutcomeButton tone="yes" />
            <OutcomeButton tone="no" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#282d37] px-4 py-3 text-[11px] text-[#8b94a9] md:px-5">
        <span>Price via Pragma Oracle</span>
        <span>One-click execution via Session Keys. No pop-ups.</span>
      </div>
    </section>
  );
}

function OutcomeButton({ tone }: { tone: "yes" | "no" }) {
  const isYes = tone === "yes";

  return (
    <button
      type="button"
      className={`flex h-[64px] w-full flex-col items-center justify-center rounded-[14px] text-center ${
        isYes
          ? "bg-[#25c980] text-white"
          : "bg-[#f05454] text-white"
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
        {isYes ? "Bet Yes" : "Bet No"}
      </span>
      <span className="[font-family:var(--font-syne)] mt-1 text-[26px] font-semibold leading-none">
        --
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

function GlobalFeedCard() {
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
        {globalFeedItems.map((item) => (
          <div
            key={item.title}
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
        ))}
      </div>
    </section>
  );
}

function TransparencyCard() {
  return (
    <section className="rounded-[20px] bg-[linear-gradient(180deg,#171b22,#11151b)] px-5 py-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#62a6ff]">
        Transparency
      </span>
      <h3 className="mt-4 [font-family:var(--font-syne)] text-[26px] font-semibold leading-[1.02] text-white">
        Secured by Pragma Oracle
      </h3>
      <p className="mt-4 text-[14px] leading-7 text-[#97a0b5]">
        Resolution and price references will be anchored to oracle rails once
        the prediction engine is wired into live execution.
      </p>
      <button
        type="button"
        className="mt-5 text-[13px] font-semibold text-[#3b5bff]"
      >
        View Verification Contract
      </button>
    </section>
  );
}

function MobileExecutionBar() {
  return (
    <section className="mt-5 rounded-[18px] border border-[#1b2457] bg-[#101840] px-4 py-4 md:hidden">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2d79] text-[#87a0ff]">
          <PredictShieldIcon />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-[#9fb2ff]">
            One-click Execution Enabled
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#8697cf]">
            Session-key rail is ready. Markets stay empty until the oracle and
            execution backend are connected.
          </p>
        </div>
      </div>
    </section>
  );
}

function FilterPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#151920] px-3 py-1.5 text-[11px] font-semibold text-[#c6cede]">
      {children}
    </span>
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
