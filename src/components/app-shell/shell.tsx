import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAppNav, type AppNavIcon, type AppSection } from "./navigation";

type AppUser = {
  name?: string | null;
  email?: string | null;
};

type BaseShellProps = {
  title: string;
  currentSection: AppSection;
  signOutAction: () => Promise<void>;
  user: AppUser;
  children: ReactNode;
};

export function TopbarAppShell({
  children,
  currentSection,
  signOutAction,
  title,
  user,
}: BaseShellProps) {
  const navItems = getAppNav(currentSection);

  return (
    <main className="min-h-screen bg-[#040507] text-white">
      <div className="mx-auto min-h-screen max-w-[1500px] border-x border-[#241c61] bg-black md:border md:border-[#241c61]">
        <TopbarHeader signOutAction={signOutAction} title={title} user={user} />

        <div className="px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6 lg:px-8">
          {children}
        </div>

        <BottomNav items={navItems} desktop />
        <BottomNav items={navItems} />
      </div>
    </main>
  );
}

export function SidebarAppShell({
  children,
  currentSection,
  signOutAction,
  title,
  user,
}: BaseShellProps) {
  const navItems = getAppNav(currentSection);

  return (
    <main className="min-h-screen bg-[#040507] text-white">
      <div className="mx-auto min-h-screen max-w-[1500px] border-x border-[#241c61] bg-black md:border md:border-[#241c61]">
        <div className="md:grid md:min-h-screen md:grid-cols-[220px_minmax(0,1fr)]">
          <DesktopSidebar items={navItems} />

          <div className="min-w-0">
            <TopbarHeader
              signOutAction={signOutAction}
              title={title}
              user={user}
              hideDesktopLogo
            />

            <div className="px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6 lg:px-8">
              {children}
            </div>
          </div>
        </div>

        <BottomNav items={navItems} />
      </div>
    </main>
  );
}

function TopbarHeader({
  hideDesktopLogo,
  signOutAction,
  title,
  user,
}: {
  title: string;
  signOutAction: () => Promise<void>;
  user: AppUser;
  hideDesktopLogo?: boolean;
}) {
  return (
    <header className="border-b border-[#1a1d27] px-4 py-4 md:px-6 md:py-5">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href="/dashboard"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3151ff] shadow-[0_10px_30px_rgba(49,81,255,0.28)] md:h-10 md:w-10 md:rounded-[11px] ${
            hideDesktopLogo ? "md:hidden" : ""
          }`}
        >
          <Image
            src="/logo.png"
            alt="StarkFlow logo"
            width={18}
            height={18}
            className="h-[18px] w-auto object-contain"
          />
        </Link>
        {hideDesktopLogo ? (
          <div className="hidden md:block md:h-10 md:w-10" />
        ) : null}

        <p className="text-center [font-family:var(--font-syne)] text-[18px] font-semibold md:text-[20px]">
          {title}
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

function DesktopSidebar({
  items,
}: {
  items: Array<{
    id: AppSection;
    label: string;
    href: string;
    icon: AppNavIcon;
    active: boolean;
  }>;
}) {
  return (
    <aside className="hidden border-r border-[#1a1d27] bg-[#1a1d24] md:flex md:flex-col md:justify-between">
      <div className="p-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-white"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3151ff] shadow-[0_10px_30px_rgba(49,81,255,0.28)]">
            <Image
              src="/logo.png"
              alt="StarkFlow logo"
              width={18}
              height={18}
              className="h-[18px] w-auto object-contain"
            />
          </span>
          <span className="[font-family:var(--font-syne)] text-[18px] font-semibold text-[#3b5bff]">
            StarkFlow
          </span>
        </Link>

        <nav className="mt-8 space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 rounded-[12px] px-4 py-3 text-[14px] font-medium transition ${
                item.active
                  ? "bg-[#3151ff] text-white"
                  : "text-[#c2c9d9] hover:bg-[#20242e]"
              }`}
            >
              <span className={item.active ? "text-white" : "text-[#9da8c4]"}>
                <DockIcon icon={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
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
}: {
  signOutAction: () => Promise<void>;
  user: AppUser;
}) {
  return (
    <div className="absolute right-0 top-12 z-20 w-60 rounded-[16px] border border-[#262b38] bg-[#151922] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <p className="truncate text-[14px] font-semibold text-white">
        {user.name ?? "StarkFlow User"}
      </p>
      <p className="mt-1 truncate text-[12px] text-[#8a92a8]">
        {user.email ?? "Authenticated session"}
      </p>

      <div className="mt-4 border-t border-[#222735] pt-4">
        <button
          type="button"
          onClick={() => void signOutAction()}
          className="flex w-full items-center justify-between rounded-[12px] border border-[#2b3140] bg-[#1a1f2a] px-4 py-3 text-left text-[14px] font-medium text-white transition hover:border-[#3b5bff]"
        >
          Sign out
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function BottomNav({
  desktop,
  items,
}: {
  items: Array<{
    id: AppSection;
    label: string;
    href: string;
    icon: AppNavIcon;
    active: boolean;
  }>;
  desktop?: boolean;
}) {
  if (desktop) {
    return (
      <nav className="hidden border-t border-[#171b24] px-6 py-4 md:flex md:items-center md:justify-center">
        <div className="flex w-full max-w-[980px] items-center justify-between gap-4">
          {items.map((item) => (
            <NavItem key={item.id} item={item} desktop />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[84px] max-w-[460px] items-center justify-around border-x border-t border-[#231c59] bg-black/96 px-4 backdrop-blur md:hidden">
      {items.map((item) => (
        <NavItem key={item.id} item={item} />
      ))}
    </nav>
  );
}

function NavItem({
  desktop,
  item,
}: {
  item: {
    id: AppSection;
    label: string;
    href: string;
    icon: AppNavIcon;
    active: boolean;
  };
  desktop?: boolean;
}) {
  const iconColor = item.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";
  const labelColor = item.active ? "text-[#3b5bff]" : "text-[#d2d7e7]";

  if (desktop) {
    return (
      <Link
        href={item.href}
        className={`flex min-w-[180px] flex-col items-center justify-center gap-2 rounded-[14px] px-4 py-2 text-[12px] font-semibold transition ${
          item.active
            ? "border border-[#243ba4] bg-[#0d1220] text-[#3b5bff]"
            : "border border-transparent text-[#cfd5e3] hover:border-[#1d2330]"
        }`}
      >
        <span className={iconColor}>
          <DockIcon icon={item.icon} />
        </span>
        <span className={labelColor}>{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex flex-col items-center gap-1 text-[11px] font-medium"
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center ${iconColor}`}
      >
        <DockIcon icon={item.icon} />
      </span>
      <span className={labelColor}>{item.label}</span>
    </Link>
  );
}

function DockIcon({ icon }: { icon: AppNavIcon }) {
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
