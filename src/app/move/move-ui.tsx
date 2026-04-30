import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import { waitForPrivyAccessToken } from "@/lib/privy-access-token";
import {
  helpItems,
  moveTabs,
  programs,
  type MoveTab,
  type ProgramCard,
} from "./move-data";

type MoveMode = "send" | "swap" | "bridge";

type MoveCenterViewProps = {
  getAccessToken: () => Promise<string | null>;
  signOutAction: () => Promise<void>;
  preferredNetwork: "mainnet" | "sepolia";
  starknetAddress: string | null;
  user: {
    name?: string | null;
    email?: string | null;
  };
  currentTab: MoveMode;
  walletConnected: boolean;
};

type MoveTokenOption = {
  address: string;
  balanceDisplay: string | null;
  balanceRaw: string | null;
  decimals: number;
  key: string;
  logoUrl: string | null;
  name: string;
  symbol: string;
  verified: boolean;
};

type RecipientResolution = {
  address: string;
  addressShort: string;
  image: string | null;
  isInternal: boolean;
  userId: string | null;
  username: string | null;
  usernameHandle: string | null;
};

type SwapQuoteResponse = {
  amountIn: string;
  amountOut: string;
  priceImpactBps: string | null;
  provider: string;
  routeCallCount: number | null;
  tokenIn: MoveTokenOption;
  tokenOut: MoveTokenOption;
};

type SubmitState =
  | { error: string; status: "error" }
  | { message: string; status: "success" }
  | null;

const moveTokenListCache = new Map<string, MoveTokenOption[]>();
const moveTokenBalanceCache = new Map<
  string,
  {
    balanceDisplay: string | null;
    balanceRaw: string | null;
  }
>();

async function fetchPrivyJson<T>(
  getAccessToken: () => Promise<string | null>,
  input: string,
  init?: RequestInit,
) {
  const token = await waitForPrivyAccessToken(getAccessToken);

  if (!token) {
    throw new Error("Privy token not ready");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}`,
    );
  }

  return payload as T;
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function tokenBalanceCacheKey(tokenAddress: string) {
  return tokenAddress.toLowerCase();
}

export function MoveCenterView({
  currentTab,
  getAccessToken,
  preferredNetwork,
  signOutAction,
  starknetAddress,
  user,
  walletConnected,
}: MoveCenterViewProps) {
  return (
    <TopbarAppShell
      title="Move Center"
      currentSection="move"
      signOutAction={signOutAction}
      user={user}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div>
          <SectionEyebrow title="Instant" accent="Move assets now" />
          <MainMovePanel
            currentTab={currentTab}
            getAccessToken={getAccessToken}
            preferredNetwork={preferredNetwork}
            starknetAddress={starknetAddress}
            walletConnected={walletConnected}
          />
        </div>

        <div className="space-y-4">
          <SideRailCard currentTab={currentTab} walletConnected={walletConnected} />
          <RecentActivityCard currentTab={currentTab} />
          <HelpCard currentTab={currentTab} />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionEyebrow title="Programs" accent="Automate wealth" />
          <span className="hidden text-[12px] font-semibold text-[#3b5bff] md:inline">
            View Catalog
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((program) => (
            <ProgramPanel key={program.title} program={program} />
          ))}
        </div>
      </div>
    </TopbarAppShell>
  );
}

function MoveHeader({
  signOutAction,
  user,
}: Pick<MoveCenterViewProps, "signOutAction" | "user">) {
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

        <p className="text-center [font-family:var(--font-syne)] text-[18px] font-semibold md:text-[20px]">
          Move Center
        </p>

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
}: Pick<MoveCenterViewProps, "signOutAction" | "user">) {
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

function SectionEyebrow({
  accent,
  title,
}: {
  title: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="[font-family:var(--font-syne)] text-[28px] font-semibold md:text-[34px]">
        {title}
      </h2>
      <span className="pt-1 text-[14px] font-medium text-[#3b5bff]">
        / {accent}
      </span>
    </div>
  );
}

function MainMovePanel({
  currentTab,
  getAccessToken,
  preferredNetwork,
  starknetAddress,
  walletConnected,
}: Pick<
  MoveCenterViewProps,
  "currentTab" | "getAccessToken" | "preferredNetwork" | "starknetAddress" | "walletConnected"
>) {
  return (
    <section className="mt-4 overflow-hidden rounded-[20px] border border-[#272c35] bg-[#1f232b]">
      <div className="border-b border-[#2a303a] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#181c23] p-1">
          <ModeLink mode="send" currentTab={currentTab}>
            Send
          </ModeLink>
          <ModeLink mode="swap" currentTab={currentTab}>
            Swap
          </ModeLink>
          <ModeLink mode="bridge" currentTab={currentTab}>
            Bridge
          </ModeLink>
        </div>
      </div>

      <div className="px-4 py-5 md:px-5 md:py-5">
        {currentTab === "send" ? (
          <SendPanel
            getAccessToken={getAccessToken}
            preferredNetwork={preferredNetwork}
            starknetAddress={starknetAddress}
          />
        ) : null}
        {currentTab === "swap" ? (
          <SwapPanel
            getAccessToken={getAccessToken}
            preferredNetwork={preferredNetwork}
            starknetAddress={starknetAddress}
          />
        ) : null}
        {currentTab === "bridge" ? <BridgePanel walletConnected={walletConnected} /> : null}
      </div>
    </section>
  );
}

function ModeLink({
  children,
  currentTab,
  mode,
}: {
  children: ReactNode;
  currentTab: MoveMode;
  mode: MoveMode;
}) {
  const active = currentTab === mode;

  return (
    <Link
      href={mode === "bridge" ? "/move?tab=bridge" : `/move?tab=${mode}`}
      className={`inline-flex min-w-[96px] items-center justify-center rounded-[12px] px-4 py-3 text-[14px] font-semibold ${
        active ? "bg-[#3151ff] text-white" : "text-[#adb4c7]"
      }`}
    >
      {children}
    </Link>
  );
}

function SendPanel({
  getAccessToken,
  preferredNetwork,
  starknetAddress,
}: Pick<MoveCenterViewProps, "getAccessToken" | "preferredNetwork" | "starknetAddress">) {
  const [selectedToken, setSelectedToken] = useState<MoveTokenOption | null>(null);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipient, setRecipient] = useState<RecipientResolution | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [state, setState] = useState<SubmitState>(null);

  async function hydrateTokenBalance(token: MoveTokenOption) {
    const cacheKey = tokenBalanceCacheKey(token.address);
    const cached = moveTokenBalanceCache.get(cacheKey);

    if (cached) {
      return {
        ...token,
        ...cached,
      };
    }

    const payload = await fetchPrivyJson<{
      address: string;
      balanceDisplay: string | null;
      balanceRaw: string | null;
    }>(
      getAccessToken,
      `/api/move/token-balance?token=${encodeURIComponent(token.address)}`,
    );

    const balance = {
      balanceDisplay: payload.balanceDisplay,
      balanceRaw: payload.balanceRaw,
    };

    moveTokenBalanceCache.set(cacheKey, balance);

    return {
      ...token,
      ...balance,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultToken() {
      try {
        const cacheKey = `${preferredNetwork}:featured`;
        const cachedTokens = moveTokenListCache.get(cacheKey);
        const payload =
          cachedTokens
            ? { tokens: cachedTokens }
            : await fetchPrivyJson<{ tokens: MoveTokenOption[] }>(
                getAccessToken,
                "/api/move/tokens?limit=12",
              );

        if (!cachedTokens) {
          moveTokenListCache.set(cacheKey, payload.tokens);
        }

        const defaultToken =
          payload.tokens.find((token) => token.symbol === "STRK") ??
          payload.tokens[0] ??
          null;

        if (!defaultToken || cancelled) {
          return;
        }

        const hydrated = await hydrateTokenBalance(defaultToken);

        if (!cancelled) {
          setSelectedToken(hydrated);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Failed to load tokens.",
          });
        }
      }
    }

    void loadDefaultToken();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, preferredNetwork]);

  async function handleResolveRecipient() {
    setLookupLoading(true);
    setState(null);

    try {
      const payload = await fetchPrivyJson<RecipientResolution>(getAccessToken, "/api/move/recipient", {
        method: "POST",
        body: JSON.stringify({ query: recipientQuery }),
      });
      setRecipient(payload);
    } catch (error) {
      setRecipient(null);
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Recipient lookup failed.",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSend() {
    if (!selectedToken) return;

    setSubmitLoading(true);
    setState(null);

    try {
      const payload = await fetchPrivyJson<{ amount: string; txHash: string }>(
        getAccessToken,
        "/api/move/send",
        {
          method: "POST",
          body: JSON.stringify({
            recipientQuery,
            tokenAddress: selectedToken.address,
            amount,
          }),
        },
      );

      setState({
        status: "success",
        message: `${payload.amount} sent in ${shortHash(payload.txHash)}.`,
      });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Send failed.",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-[16px] border border-[#2b313d] bg-[#1b2028] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[28px]">
              Gasless Send
            </p>
            <p className="mt-1 text-[13px] text-[#98a1b4]">
              Send by exact StarkFlow username or direct Starknet address.
            </p>
          </div>
          <span className="rounded-full bg-[#11204f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
            {preferredNetwork}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-[14px] border border-[#2a303b] bg-black px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel>Your Wallet</FieldLabel>
              <span className="text-[12px] text-[#9ca5b8]">
                {starknetAddress ? shortHash(starknetAddress) : "Wallet not ready"}
              </span>
            </div>
          </div>

          <div>
            <FieldLabel>Recipient</FieldLabel>
            <div className="mt-2 flex gap-2">
              <input
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setRecipient(null);
                }}
                placeholder="username, @username.stark or 0x..."
                className="h-12 flex-1 rounded-[12px] border border-[#2a303b] bg-black px-4 text-[14px] text-white outline-none placeholder:text-[#677086]"
              />
              <button
                type="button"
                onClick={handleResolveRecipient}
                disabled={lookupLoading || !recipientQuery.trim()}
                className="rounded-[12px] border border-[#30458e] bg-[#13255f] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {lookupLoading ? "Checking..." : "Verify"}
              </button>
            </div>
          </div>

          <div className="rounded-[16px] border border-[#1d2d78] bg-[linear-gradient(180deg,#071348,#0b165a)] p-4">
            {recipient ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7e1d7] text-[#10131c]">
                    <UserAvatarIcon />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">
                      {recipient.usernameHandle ?? recipient.addressShort}
                    </p>
                    <p className="mt-1 text-[12px] text-[#9fb1ff]">
                      {recipient.addressShort} • {recipient.isInternal ? "StarkFlow user" : "External Starknet wallet"}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#14331f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ce19c]">
                  verified
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7e1d7] text-[#10131c]">
                  <UserAvatarIcon />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-white">
                    No verified recipient selected
                  </p>
                  <p className="mt-1 text-[12px] text-[#9fb1ff]">
                    Search the exact username you want to send to.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Token</FieldLabel>
              <span className="text-[12px] text-[#9ca5b8]">Verified Starknet token</span>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 flex h-12 w-full items-center justify-between rounded-[12px] border border-[#2a303b] bg-black px-4 text-left"
            >
              <div className="flex items-center gap-3">
                <TokenBadge symbol={selectedToken?.symbol ?? "?"} />
                <div>
                  <p className="text-[14px] font-semibold text-white">
                    {selectedToken?.symbol ?? "Choose token"}
                  </p>
                  <p className="text-[12px] text-[#8c95aa]">
                    {selectedToken?.balanceDisplay ?? "Balance unavailable"}
                  </p>
                </div>
              </div>
              <ChevronDownIcon />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Amount</FieldLabel>
              <button
                type="button"
                onClick={() => {
                  if (!selectedToken?.balanceDisplay) return;
                  setAmount(selectedToken.balanceDisplay.split(" ")[0] ?? "");
                }}
                className="text-[12px] font-semibold text-[#4f78ff]"
              >
                Use Max
              </button>
            </div>

            <div className="mt-2 rounded-[16px] border border-[#313744] bg-[#22262f] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    className="[font-family:var(--font-syne)] w-full bg-transparent text-[42px] leading-none tracking-[-0.04em] text-white outline-none placeholder:text-[#5f6678]"
                  />
                  <p className="mt-3 text-[13px] text-[#a6afc2]">
                    {selectedToken?.balanceDisplay ?? "Balance unavailable"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span className="rounded-full bg-[#343947] px-3 py-2 text-[12px] font-semibold text-white">
                    {selectedToken?.symbol ?? "TOKEN"}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b7c2d8]">
                    gasless
                  </span>
                </div>
              </div>
            </div>
          </div>

          <InlineState state={state} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a303a] pt-4">
        <p className="text-[13px] text-[#9ba3b7]">
          Usernames are unique in the database and resolve to the saved Starknet address.
        </p>
        <p className="text-[13px] font-semibold text-[#dfe4f3]">
          StarkFlow sponsorship stays on the execution path when enabled.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={submitLoading || !selectedToken || !recipient || !amount.trim()}
        className="mt-4 h-12 w-full rounded-[12px] bg-[#3151ff] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(49,81,255,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLoading ? "Sending..." : "Send Gasless"}
      </button>

      <TokenPickerDialog
        getAccessToken={getAccessToken}
        onClose={() => setPickerOpen(false)}
        onSelect={async (token) => {
          const hydrated = await hydrateTokenBalance(token);
          setSelectedToken(hydrated);
          setPickerOpen(false);
        }}
        open={pickerOpen}
        title="Select token to send"
      />
    </>
  );
}

function SwapPanel({
  getAccessToken,
  preferredNetwork,
  starknetAddress,
}: Pick<MoveCenterViewProps, "getAccessToken" | "preferredNetwork" | "starknetAddress">) {
  const [tokenIn, setTokenIn] = useState<MoveTokenOption | null>(null);
  const [tokenOut, setTokenOut] = useState<MoveTokenOption | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"in" | "out" | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [state, setState] = useState<SubmitState>(null);

  async function hydrateTokenBalance(token: MoveTokenOption) {
    const cacheKey = tokenBalanceCacheKey(token.address);
    const cached = moveTokenBalanceCache.get(cacheKey);

    if (cached) {
      return {
        ...token,
        ...cached,
      };
    }

    const payload = await fetchPrivyJson<{
      address: string;
      balanceDisplay: string | null;
      balanceRaw: string | null;
    }>(
      getAccessToken,
      `/api/move/token-balance?token=${encodeURIComponent(token.address)}`,
    );

    const balance = {
      balanceDisplay: payload.balanceDisplay,
      balanceRaw: payload.balanceRaw,
    };

    moveTokenBalanceCache.set(cacheKey, balance);

    return {
      ...token,
      ...balance,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultTokens() {
      try {
        const cacheKey = `${preferredNetwork}:featured`;
        const cachedTokens = moveTokenListCache.get(cacheKey);
        const payload =
          cachedTokens
            ? { tokens: cachedTokens }
            : await fetchPrivyJson<{ tokens: MoveTokenOption[] }>(
                getAccessToken,
                "/api/move/tokens?limit=14",
              );

        if (!cachedTokens) {
          moveTokenListCache.set(cacheKey, payload.tokens);
        }

        const defaultIn =
          payload.tokens.find((token) => token.symbol === "STRK") ??
          payload.tokens[0] ??
          null;
        const defaultOut =
          payload.tokens.find((token) => token.symbol === "USDC") ??
          payload.tokens.find((token) => token.symbol !== "STRK") ??
          payload.tokens[1] ??
          null;

        if (!defaultIn || !defaultOut || cancelled) return;

        const [hydratedIn, hydratedOut] = await Promise.all([
          hydrateTokenBalance(defaultIn),
          hydrateTokenBalance(defaultOut),
        ]);

        if (!cancelled) {
          setTokenIn(hydratedIn);
          setTokenOut(hydratedOut);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Failed to load tokens.",
          });
        }
      }
    }

    void loadDefaultTokens();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, preferredNetwork]);

  async function handleQuote() {
    if (!tokenIn || !tokenOut) return;

    setQuoteLoading(true);
    setState(null);

    try {
      const payload = await fetchPrivyJson<SwapQuoteResponse>(
        getAccessToken,
        "/api/move/swap/quote",
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            tokenInAddress: tokenIn.address,
            tokenOutAddress: tokenOut.address,
            slippageBps: 100,
          }),
        },
      );
      setQuote(payload);
    } catch (error) {
      setQuote(null);
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Quote request failed.",
      });
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleExecute() {
    if (!tokenIn || !tokenOut) return;

    setSubmitLoading(true);
    setState(null);

    try {
      const payload = await fetchPrivyJson<SwapQuoteResponse & { txHash: string }>(
        getAccessToken,
        "/api/move/swap/execute",
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            tokenInAddress: tokenIn.address,
            tokenOutAddress: tokenOut.address,
            slippageBps: 100,
          }),
        },
      );
      setQuote(payload);
      setState({
        status: "success",
        message: `Swap submitted in ${shortHash(payload.txHash)}.`,
      });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Swap failed.",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  const quoteHint = useMemo(() => {
    if (!quote) return "Quote is fetched from Starkzap AVNU routing.";

    const parts = [
      `${quote.amountOut} estimated`,
      quote.routeCallCount ? `${quote.routeCallCount} route calls` : null,
      quote.priceImpactBps ? `${quote.priceImpactBps} bps impact` : null,
    ].filter(Boolean);

    return parts.join(" • ");
  }, [quote]);

  return (
    <>
      <div className="rounded-[16px] border border-[#2b313d] bg-[#1b2028] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[28px]">
              Instant Swap
            </p>
            <p className="mt-1 text-[13px] text-[#98a1b4]">
              Starkzap verified tokens on the active Starknet network.
            </p>
          </div>
          <span className="rounded-full bg-[#11204f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
            {preferredNetwork}
          </span>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#2a303b] bg-black px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Wallet</FieldLabel>
            <span className="text-[12px] text-[#9ca5b8]">
              {starknetAddress ? shortHash(starknetAddress) : "Wallet not ready"}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <SwapInputCard
            balance={tokenIn?.balanceDisplay ?? "Balance unavailable"}
            label="You Pay"
            onAmountChange={(value) => {
              setAmount(value);
              setQuote(null);
            }}
            onTokenClick={() => setPickerTarget("in")}
            token={tokenIn}
            value={amount}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setTokenIn(tokenOut);
                setTokenOut(tokenIn);
                setQuote(null);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#313644] bg-[#191e26] text-[#6e88ff]"
            >
              <SwapIcon />
            </button>
          </div>

          <SwapOutputCard
            hint={quoteHint}
            label="You Receive"
            onTokenClick={() => setPickerTarget("out")}
            token={tokenOut}
            value={quote?.amountOut ?? "0.0"}
          />

          <InlineState state={state} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a303a] pt-4">
        <p className="text-[13px] text-[#9ba3b7]">
          Quotes and execution both use Starkzap AVNU routing.
        </p>
        <p className="text-[13px] font-semibold text-[#dfe4f3]">
          Sponsored execution applies when the AVNU paymaster is enabled.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={handleQuote}
          disabled={!tokenIn || !tokenOut || !amount.trim() || quoteLoading}
          className="h-12 rounded-[12px] border border-[#30458e] bg-[#13255f] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {quoteLoading ? "Quoting..." : "Fetch Quote"}
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={!tokenIn || !tokenOut || !amount.trim() || submitLoading}
          className="h-12 rounded-[12px] bg-[#3151ff] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(49,81,255,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLoading ? "Swapping..." : "Execute Swap"}
        </button>
      </div>

      <TokenPickerDialog
        getAccessToken={getAccessToken}
        onClose={() => setPickerTarget(null)}
        onSelect={async (token) => {
          const hydrated = await hydrateTokenBalance(token);
          if (pickerTarget === "in") {
            setTokenIn(hydrated);
          } else if (pickerTarget === "out") {
            setTokenOut(hydrated);
          }
          setQuote(null);
          setPickerTarget(null);
        }}
        open={pickerTarget !== null}
        title={pickerTarget === "in" ? "Select token to sell" : "Select token to buy"}
      />
    </>
  );
}

function SwapInputCard({
  balance,
  label,
  onAmountChange,
  onTokenClick,
  token,
  value,
}: {
  balance: string;
  label: string;
  onAmountChange: (value: string) => void;
  onTokenClick: () => void;
  token: MoveTokenOption | null;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#2a303b] bg-black px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[12px] text-[#9ca5b8]">{balance}</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0.0"
          className="[font-family:var(--font-syne)] min-w-0 flex-1 bg-transparent text-[32px] leading-none tracking-[-0.04em] text-white outline-none placeholder:text-[#5f6678]"
        />
        <TokenSelectButton token={token} onClick={onTokenClick} />
      </div>
    </div>
  );
}

function SwapOutputCard({
  hint,
  label,
  onTokenClick,
  token,
  value,
}: {
  hint: string;
  label: string;
  onTokenClick: () => void;
  token: MoveTokenOption | null;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#2a303b] bg-black px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[12px] text-[#9ca5b8]">{hint}</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="[font-family:var(--font-syne)] min-w-0 flex-1 truncate text-[32px] leading-none tracking-[-0.04em] text-white">
          {value}
        </p>
        <TokenSelectButton token={token} onClick={onTokenClick} />
      </div>
    </div>
  );
}

function TokenPickerDialog({
  getAccessToken,
  onClose,
  onSelect,
  open,
  title,
}: {
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
  onSelect: (token: MoveTokenOption) => void;
  open: boolean;
  title: string;
}) {
  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<MoveTokenOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const cacheKey = `picker:${query.trim().toLowerCase() || "__default__"}`;
        const cachedTokens = moveTokenListCache.get(cacheKey);
        const payload =
          cachedTokens
            ? { tokens: cachedTokens }
            : await fetchPrivyJson<{ tokens: MoveTokenOption[] }>(
                getAccessToken,
                `/api/move/tokens?q=${encodeURIComponent(query)}&limit=24`,
              );

        if (!cachedTokens) {
          moveTokenListCache.set(cacheKey, payload.tokens);
        }

        if (!cancelled) {
          setTokens(payload.tokens);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load verified tokens.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getAccessToken, open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[80vh] w-full max-w-[560px] overflow-hidden rounded-[22px] border border-[#2a303b] bg-[#11151c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[#1e2430] px-5 py-4">
          <div>
            <p className="[font-family:var(--font-syne)] text-[24px] font-semibold text-white">
              {title}
            </p>
            <p className="mt-1 text-[13px] text-[#93a0bc]">
              Starkzap verified token list for the active network.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-[#2b313d] px-3 py-2 text-[12px] font-semibold text-white"
          >
            Close
          </button>
        </div>

        <div className="border-b border-[#1e2430] px-5 py-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol, name, or contract"
            className="h-12 w-full rounded-[12px] border border-[#2a303b] bg-black px-4 text-[14px] text-white outline-none placeholder:text-[#677086]"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="px-3 py-8 text-center text-[13px] text-[#93a0bc]">
              Loading verified tokens...
            </div>
          ) : error ? (
            <div className="px-3 py-8 text-center text-[13px] text-[#ffb1bc]">{error}</div>
          ) : tokens.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-[#93a0bc]">
              No matching verified tokens found.
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => onSelect(token)}
                  className="flex w-full items-center justify-between rounded-[14px] border border-[#222834] bg-[#161b22] px-4 py-3 text-left transition hover:border-[#3650af]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <TokenBadge symbol={token.symbol} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">
                        {token.symbol}
                      </p>
                      <p className="truncate text-[12px] text-[#8d97ad]">
                        {token.name}
                      </p>
                      <p className="truncate text-[11px] text-[#677086]">{token.address}</p>
                    </div>
                  </div>
                  <div className="ml-3 text-right">
                    <p className="text-[12px] font-semibold text-[#dfe4f3]">
                      {token.balanceDisplay ?? "Verified token"}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#7ea1ff]">
                      verified
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenSelectButton({
  token,
  onClick,
}: {
  token: MoveTokenOption | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-[#262b35] px-3 py-2 text-[12px] font-semibold text-white"
    >
      <TokenBadge symbol={token?.symbol ?? "?"} small />
      {token?.symbol ?? "Choose"}
      <ChevronDownIcon />
    </button>
  );
}

function TokenBadge({ symbol, small }: { symbol: string; small?: boolean }) {
  const initials = symbol.slice(0, 3).toUpperCase();

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#101726] font-semibold text-[#9fb1ff] ${
        small ? "h-6 w-6 text-[9px]" : "h-10 w-10 text-[11px]"
      }`}
    >
      {initials}
    </span>
  );
}

function InlineState({ state }: { state: SubmitState }) {
  if (!state) return null;

  if (state.status === "success") {
    return (
      <div className="rounded-[14px] border border-[#214f32] bg-[#0f2517] px-4 py-3 text-[13px] text-[#98e5b1]">
        {state.message}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#5a232c] bg-[#2a1418] px-4 py-3 text-[13px] text-[#ffb1bc]">
      {state.error}
    </div>
  );
}

function BridgePanel({ walletConnected }: { walletConnected: boolean }) {
  if (!walletConnected) {
    return (
      <>
        <div className="rounded-[16px] border border-[#2f3356] bg-[linear-gradient(180deg,#22264b,#1a1d2f)] p-4">
          <span className="rounded-full bg-[#ff8a34] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            New: Cross-chain
          </span>
          <h3 className="mt-4 [font-family:var(--font-syne)] text-[28px] font-semibold leading-none">
            Bridge BTC to Starknet
          </h3>
          <p className="mt-3 max-w-[720px] text-[14px] leading-6 text-[#c7cee2]">
            Connect a BTC wallet through WalletConnect to open the bridge in and
            bridge out rail. Zero gas fee messaging stays ready here for the StarkFlow
            sponsored Starknet side.
          </p>

          <Link
            href="/move?tab=bridge&wallet=connected"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-white text-[14px] font-semibold text-[#111318]"
          >
            <BridgeIcon />
            Connect BTC Wallet
          </Link>
        </div>

        <PanelFooter
          left="Bridge routing opens after wallet connection"
          right="Starknet side targets zero gas fee"
          buttonLabel="Bridge rail locked"
          buttonDisabled
        />
      </>
    );
  }

  return (
    <>
      <div className="rounded-[16px] border border-[#2f3356] bg-[linear-gradient(180deg,#22264b,#1a1d2f)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="[font-family:var(--font-syne)] text-[28px] font-semibold leading-none">
              BTC Bridge Flow
            </p>
            <p className="mt-2 text-[14px] text-[#c7cee2]">
              Connected wallet detected. Choose your Starknet bridge direction.
            </p>
          </div>
          <span className="rounded-full bg-[#14331f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ce19c]">
            Wallet connected
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[16px] border border-[#38405e] bg-[#161b2b] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9eabca]">
              Bridge In
            </p>
            <p className="mt-3 [font-family:var(--font-syne)] text-[24px] font-semibold">
              BTC to Starknet
            </p>
            <p className="mt-3 text-[13px] leading-6 text-[#b8c2dc]">
              Move BTC into StarkFlow and finish on the Starknet side with zero gas fee messaging.
            </p>
          </div>

          <div className="rounded-[16px] border border-[#38405e] bg-[#161b2b] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9eabca]">
              Bridge Out
            </p>
            <p className="mt-3 [font-family:var(--font-syne)] text-[24px] font-semibold">
              Starknet to BTC
            </p>
            <p className="mt-3 text-[13px] leading-6 text-[#b8c2dc]">
              Route assets back out when your Starknet wallet has live funds ready to exit.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[14px] border border-[#38405e] bg-[#0d1220] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Amount</FieldLabel>
            <span className="text-[12px] text-[#9ca5b8]">WalletConnect rail</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="[font-family:var(--font-syne)] text-[32px] leading-none tracking-[-0.04em]">
              0.0
            </p>
            <span className="rounded-full bg-[#262b35] px-3 py-2 text-[12px] font-semibold text-white">
              BTC
            </span>
          </div>
        </div>
      </div>

      <PanelFooter
        left="Bridge fee: pending route quote"
        right="Starknet arrival: zero gas fee target"
        buttonLabel="Open Bridge Route"
      />
    </>
  );
}

function PanelFooter({
  buttonDisabled,
  buttonLabel,
  left,
  right,
}: {
  left: string;
  right: string;
  buttonLabel: string;
  buttonDisabled?: boolean;
}) {
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a303a] pt-4">
        <p className="text-[13px] text-[#9ba3b7]">{left}</p>
        <p className="text-[13px] font-semibold text-[#dfe4f3]">{right}</p>
      </div>

      <button
        type="button"
        disabled={buttonDisabled}
        className={`mt-4 h-12 w-full rounded-[12px] text-[15px] font-semibold ${
          buttonDisabled
            ? "bg-[#252a34] text-[#9099ae]"
            : "bg-[#3151ff] text-white shadow-[0_14px_40px_rgba(49,81,255,0.26)]"
        }`}
      >
        {buttonLabel}
      </button>
    </>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#97a0b5]">
      {children}
    </p>
  );
}

function SearchBox() {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[#2a303b] bg-black px-4 py-4 text-[#8d96aa]">
      <SearchIcon />
      <span className="text-[14px]">Username, .stark or address</span>
    </div>
  );
}

function SideRailCard({
  currentTab,
  walletConnected,
}: Pick<MoveCenterViewProps, "currentTab" | "walletConnected">) {
  if (currentTab === "bridge") {
    return (
      <section className="rounded-[20px] border border-[#272c35] bg-[#1f232b] px-5 py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9aa2b6]">
          Bridge Status
        </p>
        <div className="mt-4 space-y-3">
          <BridgeStatusRow label="BTC Wallet" value={walletConnected ? "Connected" : "Disconnected"} />
          <BridgeStatusRow label="Bridge In" value={walletConnected ? "Ready" : "Locked"} />
          <BridgeStatusRow label="Bridge Out" value={walletConnected ? "Ready" : "Locked"} />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border border-[#2f3356] bg-[linear-gradient(180deg,#22264b,#1a1d2f)] px-5 py-5">
      <span className="rounded-full bg-[#11204f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8ca7ff]">
        Live
      </span>
      <h3 className="mt-4 [font-family:var(--font-syne)] text-[30px] font-semibold leading-none">
        {currentTab === "swap" ? "Swap Rail" : "Send Rail"}
      </h3>
      <p className="mt-3 text-[14px] leading-6 text-[#c7cee2]">
        {currentTab === "swap"
          ? "StarkZap V2 routing will load here once pools, quotes, and wallet balances are live."
          : "Username and wallet-address sending becomes active after recipient resolution and live balances are available."}
      </p>
      <div className="mt-6 rounded-[14px] border border-white/10 bg-black/25 px-4 py-4 text-[13px] leading-6 text-[#d6dbeb]">
        Zero gas fee messaging stays attached to StarkFlow-sponsored Starknet execution.
      </div>
    </section>
  );
}

function BridgeStatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#2b313b] bg-[#181c23] px-4 py-4">
      <p className="text-[14px] text-white">{label}</p>
      <span className="rounded-full bg-[#14245b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
        {value}
      </span>
    </div>
  );
}

function RecentActivityCard({ currentTab }: { currentTab: MoveMode }) {
  const rows =
    currentTab === "send"
      ? [
          "No send confirmations yet",
          "No recipient resolutions yet",
          "No sponsored send entries yet",
        ]
      : currentTab === "swap"
        ? [
            "No StarkZap swap fills yet",
            "No route quote accepted yet",
            "No sponsored swap entry yet",
          ]
        : [
            "No bridge settlement yet",
            "No bridge in transfer yet",
            "No bridge out transfer yet",
          ];

  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1f232b] px-5 py-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9aa2b6]">
        Recent Activity
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-[14px] border border-[#2b313b] bg-[#181c23] px-4 py-4"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#202530] text-[#8796b8]">
              <ClockIcon />
            </span>
            <div>
              <p className="text-[14px] font-medium text-white">{item}</p>
              <p className="mt-1 text-[12px] text-[#8e97ab]">
                Live entries appear after real execution
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HelpCard({ currentTab }: { currentTab: MoveMode }) {
  const filteredItems =
    currentTab === "send"
      ? helpItems
      : currentTab === "swap"
        ? [
            {
              title: "What is Gasless Swap?",
              body: "StarkFlow sponsors supported Starknet swaps after live paymaster rails and StarkZap execution are connected.",
            },
            {
              title: "How swap routing works",
              body: "The route stays empty until wallet balances, pools, and StarkZap pathing are live.",
            },
            {
              title: "Network support",
              body: "Swap execution stays on Starknet and aims for zero gas fee when the sponsor policy is active.",
            },
          ]
        : helpItems;

  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1f232b] px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[#5f7dff]">
          <InfoIcon />
        </span>
        <p className="text-[14px] font-semibold text-white">Center Help</p>
      </div>

      <div className="mt-4 space-y-3">
        {filteredItems.map((item) => (
          <details
            key={item.title}
            className="rounded-[14px] border border-[#2b313b] bg-[#181c23] px-4 py-4"
          >
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-white [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-3">
                <span>{item.title}</span>
                <ChevronDownIcon />
              </div>
            </summary>
            <p className="mt-3 text-[13px] leading-6 text-[#94a0b6]">
              {item.body}
            </p>
          </details>
        ))}
      </div>

      <button
        type="button"
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-black text-[13px] font-semibold text-white"
      >
        <DocIcon />
        Read Documentation
      </button>
    </section>
  );
}

function ProgramPanel({ program }: { program: ProgramCard }) {
  return (
    <section className="rounded-[20px] border border-[#272c35] bg-[#1f232b] px-5 py-6">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#14245b] text-[#6f8dff]">
          {program.icon === "dca" ? <LoopIcon /> : <YieldIcon />}
        </span>
        <span className="rounded-full bg-[#14245b] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
          {program.badge}
        </span>
      </div>

      <h3 className="mt-5 [font-family:var(--font-syne)] text-[30px] font-semibold leading-none">
        {program.title}
      </h3>
      <p className="mt-4 text-[14px] leading-7 text-[#9ba4b8]">
        {program.description}
      </p>
      <div className="mt-6 border-t border-[#2a303a] pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#c9d2e7]">
        {program.footer}
      </div>
    </section>
  );
}

function BottomDock() {
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[84px] max-w-[460px] items-center justify-around border-x border-t border-[#231c59] bg-black/96 px-4 backdrop-blur md:hidden">
        {moveTabs.map((tab) => (
          <DockItem key={tab.label} tab={tab} mobile />
        ))}
      </nav>

      <nav className="hidden border-t border-[#171b24] px-6 py-4 md:flex md:items-center md:justify-center">
        <div className="flex w-full max-w-[980px] items-center justify-between gap-4">
          {moveTabs.map((tab) => (
            <DockItem key={tab.label} tab={tab} />
          ))}
        </div>
      </nav>
    </>
  );
}

function DockItem({ mobile, tab }: { tab: MoveTab; mobile?: boolean }) {
  const iconColor = tab.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";
  const labelColor = tab.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";
  if (mobile) {
    return (
      <Link
        href={tab.href}
        className="flex flex-col items-center gap-1 text-[11px] font-medium"
      >
        <span className={`inline-flex h-9 w-9 items-center justify-center ${iconColor}`}>
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

function DockIcon({ icon }: { icon: MoveTab["icon"] }) {
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserAvatarIcon() {
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

function BridgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M4 15c2.5-3 5-4.5 8-4.5S17.5 12 20 15M6 12V8m12 4V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#8d96aa]" fill="none">
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M8 4h6l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 4v4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
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

function YieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M6 15c0-3.3 2.7-6 6-6m0 0V4m0 5c3.3 0 6 2.7 6 6 0 2.7-1.8 5.1-4.3 5.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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
