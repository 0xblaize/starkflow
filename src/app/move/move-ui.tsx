import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopbarAppShell } from "@/components/app-shell/shell";
import {
  helpItems,
  moveTabs,
  programs,
  sendRecipients,
  type MoveTab,
  type ProgramCard,
} from "./move-data";

type MoveMode = "send" | "swap" | "bridge";

type MoveCenterViewProps = {
  signOutAction: () => Promise<void>;
  user: {
    name?: string | null;
    email?: string | null;
  };
  currentTab: MoveMode;
  walletConnected: boolean;
};

export function MoveCenterView({
  currentTab,
  signOutAction,
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
          <MainMovePanel currentTab={currentTab} walletConnected={walletConnected} />
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
}: Omit<MoveCenterViewProps, "currentTab" | "walletConnected">) {
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
}: Omit<MoveCenterViewProps, "currentTab" | "walletConnected">) {
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
  walletConnected,
}: Pick<MoveCenterViewProps, "currentTab" | "walletConnected">) {
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
        {currentTab === "send" ? <SendPanel /> : null}
        {currentTab === "swap" ? <SwapPanel /> : null}
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

function SendPanel() {
  return (
    <>
      <div className="rounded-[16px] border border-[#2b313d] bg-[#1b2028] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[28px]">
              Gasless Send
            </p>
            <p className="mt-1 text-[13px] text-[#98a1b4]">
              Send by username or wallet address once the recipient lookup succeeds
            </p>
          </div>
          <span className="rounded-full bg-[#11204f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
            Username + Address
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <FieldLabel>Recipient</FieldLabel>
          <SearchBox />

          <div className="rounded-[16px] border border-[#1d2d78] bg-[linear-gradient(180deg,#071348,#0b165a)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7e1d7] text-[#10131c]">
                  <UserAvatarIcon />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-white">
                    No verified recipient selected
                  </p>
                  <p className="mt-1 text-[12px] text-[#9fb1ff]">
                    Search a Starknet username or paste a wallet address
                  </p>
                </div>
              </div>
              <span className="text-[#dbe3ff]">
                <ArrowRightIcon />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sendRecipients.map((recipient) => (
              <span
                key={recipient}
                className="rounded-full border border-[#313644] bg-[#171b22] px-3 py-2 text-[12px] text-[#cbd2e2]"
              >
                {recipient}
              </span>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Amount</FieldLabel>
              <button type="button" className="text-[12px] font-semibold text-[#4f78ff]">
                Use Max
              </button>
            </div>

            <div className="mt-2 rounded-[16px] border border-[#313744] bg-[#22262f] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="[font-family:var(--font-syne)] text-[42px] leading-none tracking-[-0.04em]">
                    0.00
                  </p>
                  <p className="mt-3 text-[13px] text-[#a6afc2]">$0.00 USD</p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span className="rounded-full bg-[#343947] px-3 py-2 text-[12px] font-semibold text-white">
                    STRK
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b7c2d8]">
                    gasless
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PanelFooter
        left="Network Fee: $0.00"
        right="StarkFlow Sponsorship: -$0.00"
        buttonLabel="Send Gasless"
      />
    </>
  );
}

function SwapPanel() {
  return (
    <>
      <div className="rounded-[16px] border border-[#2b313d] bg-[#1b2028] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="[font-family:var(--font-syne)] text-[24px] font-semibold md:text-[28px]">
              Instant Swap
            </p>
            <p className="mt-1 text-[13px] text-[#98a1b4]">
              Zero-slippage pathing on Starknet when live pools are available
            </p>
          </div>
          <span className="rounded-full bg-[#11204f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7ea1ff]">
            Powered by StarkZap
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <SwapField label="You Pay" balance="Balance: 0.00 BTC" value="0.0" token="BTC" />

          <div className="flex justify-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#313644] bg-[#191e26] text-[#6e88ff]">
              <SwapIcon />
            </span>
          </div>

          <SwapField label="You Receive" balance="Estimated" value="0.0" token="STRK" />
        </div>
      </div>

      <PanelFooter
        left="Exchange rate appears once live pools load"
        right="Zero gas fee when StarkFlow sponsorship is active"
        buttonLabel="Confirm Instant Swap"
      />
    </>
  );
}

function SwapField({
  balance,
  label,
  token,
  value,
}: {
  label: string;
  balance: string;
  value: string;
  token: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#2a303b] bg-black px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[12px] text-[#9ca5b8]">{balance}</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="[font-family:var(--font-syne)] text-[32px] leading-none tracking-[-0.04em]">
          {value}
        </p>
        <span className="rounded-full bg-[#262b35] px-3 py-2 text-[12px] font-semibold text-white">
          {token}
        </span>
      </div>
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
