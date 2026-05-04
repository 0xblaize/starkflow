import Image from "next/image";
import Link from "next/link";
import {
  FEATURES,
  FeatureIconType,
  FOOTER_LINKS,
  NAV_LINKS,
  STATS,
  STEPS,
} from "./landing-data";

function FeatureIcon({ type }: { type: FeatureIconType }) {
  const iconClass = "h-[18px] w-[18px] text-[#3B5BFF]";

  switch (type) {
    case "phone":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect x="8" y="3" width="8" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 17h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M12 3 18 5.5V11c0 4.2-2.6 7.3-6 8.9C8.6 18.3 6 15.2 6 11V5.5L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9.7 11.9 1.5 1.5 3.2-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "card":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 18a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15.3 18a3.7 3.7 0 0 1 4.2-3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

function StatusCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-9 w-9 text-white" fill="currentColor" aria-hidden="true">
      <path d="M24 3C12.4139 3 3 12.4139 3 24s9.4139 21 21 21 21-9.4139 21-21S35.5861 3 24 3zm0 2c10.5053 0 19 8.4947 19 19s-8.4947 19-19 19S5 34.5053 5 24 13.4947 5 24 5zm9.0039 10.9883a1.0001 1.0001 0 0 0-.8223.4375L22.293 30.5527l-6.668-5.334a1.0005 1.0005 0 1 0-1.25 1.5625l7.5 6a1.0001 1.0001 0 0 0 1.4434-.207l10.5-15a1.0001 1.0001 0 0 0-.8145-1.5859z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand({ size = 28 }: { size?: number }) {
  return (
      <div className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="StarkFlow Logo"
          width={size}
          height={size}
          className="h-auto w-auto object-contain"
        />
        <span className="text-[10px] font-bold tracking-[-0.03em] text-[#3B5BFF] md:text-[14px]">StarkFlow</span>
      </div>
  );
}

function MobileMenu() {
  return (
    <details className="relative md:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-center text-white [&::-webkit-details-marker]:hidden">
        <MenuIcon />
      </summary>
      <div className="absolute right-0 top-10 z-50 min-w-44 rounded-2xl border border-[#232838] bg-[#12151c] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
        {NAV_LINKS.map((link) => (
          <a key={link} href="#" className="block rounded-xl px-4 py-3 text-[14px] text-[#d7dbe7] transition hover:bg-[#1c2130] hover:text-white">
            {link}
          </a>
        ))}
      </div>
    </details>
  );
}

function HeroArt() {
  return (
    <div className="relative hidden h-80 w-full max-w-112.5 items-center justify-center rounded-[28px] border border-[#171b28] bg-[#12172b] md:flex lg:h-112.5 lg:max-w-115">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(59,91,255,0.14),transparent_62%)]" />
      <div className="relative h-52.5 w-52.5 overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] lg:h-75 lg:w-75">
        <Image src="/hero.png" alt="StarkFlow hero artwork" fill priority sizes="(min-width: 1024px) 300px, 210px" className="object-contain p-6 lg:p-10" />
      </div>
      <div className="absolute -bottom-7 -left-18 flex min-w-62.5 items-center gap-4 rounded-[18px] border border-[#313646] bg-[#1b1f26] px-5 py-4 text-[12px] text-[#9aa1b5] shadow-[0_22px_50px_rgba(0,0,0,0.4)]">
        <StatusCheckIcon />
          <div>
            <p className="text-[15px] font-semibold text-white">Sent to verified username</p>
            <p className="mt-1 text-[12px] text-[#a3a9ba]">Gas Fee: $0.00 Sponsored</p>
          </div>
      </div>
    </div>
  );
}

export function MarketingNav() {
  return (
    <nav className="flex h-14 items-center justify-between border-b border-[#10131a] px-4 md:h-15 md:px-8 lg:px-12">
      <div className="flex items-center gap-8 lg:gap-12">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        <div className="hidden items-center gap-7 text-[14px] text-[#8a90a6] md:flex lg:gap-9">
          {NAV_LINKS.map((link) => (
            <a key={link} href="#" className="transition hover:text-white">
              {link}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/auth?mode=signin" className="hidden text-[14px] text-[#8a90a6] transition hover:text-white md:block">
          Sign In
        </Link>
        <Link href="/auth?mode=signup" className="hidden rounded-md bg-[#3B5BFF] px-4 py-2.5 text-[14px] font-bold text-white md:block">
          Get Started
        </Link>
        <MobileMenu />
      </div>
    </nav>
  );
}

export function HeroSection() {
  return (
    <section className="px-4 pb-8 pt-6 md:min-h-[calc(100vh-60px)] md:px-8 md:pb-12 md:pt-20 lg:px-12 lg:pt-24">
      <div className="mx-auto grid max-w-295 items-center gap-8 md:h-full md:grid-cols-[minmax(0,560px)_1fr] md:gap-16 lg:grid-cols-[minmax(0,600px)_1fr]">
        <div className="max-w-150">
          <div className="mb-6 inline-flex rounded-full border border-[#1b2340] bg-[#0b1020] px-4 py-2 text-[12px] text-[#5f8fff]">
            Live on Starknet Testnet & Mainnet
          </div>

          <h1 className="[font-family:var(--font-syne)] text-[41px] leading-[0.98] tracking-[-0.06em] md:text-[72px] lg:text-[78px]">
            Crypto payments
            <br />
            for the <span className="text-[#3B5BFF]">rest of us.</span>
          </h1>

          <p className="mt-6 max-w-140 text-[12px] leading-6 text-[#8f93a3] md:text-[18px] md:leading-8">
            Gasless social payments on Starknet, send to usernames, never worry about seed phrases. The wallet that feels like a messaging app.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/auth?mode=signup" className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#3B5BFF] px-5 text-[11px] font-bold text-white md:h-14 md:px-8 md:text-[16px]">
              Get Started - Gasless
              <ArrowIcon />
            </Link>
            <a href="#sign-in" className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#3a4051] px-5 text-[11px] font-bold text-white md:h-14 md:px-8 md:text-[16px]">
              Explore 
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3 text-[10px] text-[#8d91a1] md:text-[14px]">
            <div className="flex items-center pl-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="-ml-2 h-8 w-8 rounded-full border-2 border-[#050608] bg-linear-to-br from-white to-[#99a8d8] first:ml-0" />
              ))}
            </div>
            <span className="font-semibold text-white">25,000+ users waiting to send gasless</span>
          </div>
        </div>

        <HeroArt />
      </div>
    </section>
  );
}

export function StatsSection() {
  return (
    <section className="hidden border-y border-[#10131a] bg-[#15171d] px-8 py-5 md:grid md:grid-cols-4 md:gap-5 lg:px-12">
      {STATS.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="[font-family:var(--font-syne)] text-[26px]">{stat.value}</div>
          <div className="mt-1 text-[12px] tracking-[0.14em] text-[#83899c]">{stat.label}</div>
        </div>
      ))}
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="px-4 pb-10 pt-8 md:px-8 md:pb-16 md:pt-12 lg:px-12">
      <div className="md:hidden">
        <h2 className="[font-family:var(--font-syne)] text-[28px] tracking-[-0.05em]">Why StarkFlow?</h2>
        <p className="mt-1 text-[11px] text-[#8f93a3]">Premium features for everyone.</p>
      </div>

      <div className="hidden md:block">
        <h2 className="[font-family:var(--font-syne)] text-center text-[30px] font-semibold tracking-[-0.05em] lg:text-[34px]">
          Everything you need for the future of money
        </h2>
        <p className="mx-auto mt-4 max-w-155 text-center text-[14px] leading-8 text-[#8f93a3]">
          We&apos;ve abstracted away the complexity of the blockchain so you can focus on what matters: moving your money.
        </p>
      </div>

      <div className="mx-auto mt-5 grid max-w-280 auto-cols-[160px] grid-flow-col gap-3 overflow-x-auto pb-2 md:mt-14 md:grid-flow-row md:grid-cols-3 md:auto-cols-auto md:gap-6 md:overflow-visible">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="min-h-37.5 rounded-[10px] border border-[#242833] bg-[#20242c] p-4 md:min-h-48.5 md:rounded-xl md:px-7 md:py-6">
            <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1a2552] md:mb-6 md:h-11 md:w-11 md:rounded-[14px]">
              <FeatureIcon type={feature.icon} />
            </div>
            <h3 className="[font-family:var(--font-syne)] text-[15px] md:text-[17px] md:font-semibold">{feature.title}</h3>
            <p className="mt-2 text-[10px] leading-5 text-[#8f93a3] md:mt-5 md:max-w-68.75 md:text-[13px] md:leading-8">
              {feature.desc}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how" className="bg-[#1c2027] px-4 py-8 md:px-8 md:py-16 lg:px-12">
      <div className="md:hidden">
        <h2 className="[font-family:var(--font-syne)] text-[28px] tracking-[-0.05em]">How It Works</h2>
        <p className="mt-1 text-[11px] text-[#8f93a3]">Three steps to social crypto freedom.</p>
      </div>

      <div className="mx-auto max-w-295 md:grid md:grid-cols-[0.95fr_1.05fr] md:items-center md:gap-14">
        <div className="mt-5 rounded-[10px] border border-[#2a2f38] bg-[#171a21] p-4 md:mt-0 md:border-0 md:bg-transparent md:p-0">
          {STEPS.map((step, index) => (
            <div key={step.id} className={`${index > 0 ? "mt-8" : ""} relative grid grid-cols-[24px_1fr] gap-3 md:grid-cols-[36px_1fr] md:gap-5`}>
              {index < STEPS.length - 1 ? (
                <span className="absolute left-2.5 top-6 h-[calc(100%+26px)] w-px bg-[#2a3040] md:left-4.25 md:top-9" />
              ) : null}
              <span className="relative z-10 inline-flex h-5.5 w-5.5 items-center justify-center rounded-full border border-[#3B5BFF] bg-[#101633] text-[8px] font-bold text-[#7c91ff] md:h-9 md:w-9 md:text-[11px]">
                {step.id}
              </span>
              <div>
                <h3 className="[font-family:var(--font-syne)] text-[13px] md:text-[20px]">{step.title}</h3>
                <p className="mt-2 max-w-70 text-[10px] leading-5 text-[#b0b4c0] md:text-[15px] md:leading-8">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative hidden min-h-107.5 overflow-hidden md:block">
          <span className="inline-flex rounded-full bg-[#3B5BFF] px-4 py-1.5 text-[12px] font-bold text-white">Gasless Network</span>
          <h2 className="relative z-10 mt-10 max-w-105 [font-family:var(--font-syne)] text-[64px] leading-[0.92] tracking-[-0.06em]">
            Complex infrastructure, <span className="text-[#3B5BFF]">simplified for you.</span>
          </h2>
          <p className="relative z-10 mt-5 max-w-115 text-[16px] leading-8 text-[#c0c4cf]">
            StarkFlow leverages STARK-proofs and Account Abstraction to deliver a user experience that was previously impossible in decentralized finance.
          </p>
          <a href="#security" className="relative z-10 mt-7 inline-flex items-center gap-2 text-[16px] font-bold text-[#3B5BFF]">
            Learn about Security
            <ArrowIcon />
          </a>
          <svg aria-hidden="true" viewBox="0 0 420 420" className="pointer-events-none absolute -right-7.5 top-0 h-105 w-105 text-[#243a9b]/20">
            <path d="M256 24 168 190h74L170 396l176-206h-78l-12-166Z" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="px-4 py-8 md:px-8 md:py-12 lg:px-12">
      <div className="relative mx-auto max-w-350 overflow-hidden rounded-[14px] bg-[#3151ff] px-4 py-8 text-center md:rounded-xl md:px-6 md:py-12">
        <div className="absolute right-5 top-5 h-6 w-6 rotate-20 rounded-lg border-2 border-white/20" />
        <h2 className="relative mx-auto max-w-175 [font-family:var(--font-syne)] text-[23px] leading-[1.02] tracking-[-0.05em] md:text-[52px]">
          Ready to experience
          <br />
          the
          <br />
          future of social
          <br />
          payments?
        </h2>
        <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/auth?mode=signup" className="inline-flex h-11 items-center justify-center rounded-[10px] bg-black px-5 text-[11px] font-bold text-[#fdfdff] md:h-14 md:px-8 md:text-[16px]">
              Get Started For Free
            </Link>
          <a href="#sales" className="inline-flex h-11 items-center justify-center rounded-[10px] border border-white/30 px-5 text-[11px] font-bold text-white md:h-14 md:px-8 md:text-[16px]">
            Talk to Sales
          </a>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#10131a] px-4 pb-6 pt-8 md:px-8 lg:px-12">
      <div className="mx-auto grid max-w-350 gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Brand size={24} />
          <p className="mt-3 max-w-70 text-[10px] leading-5 text-[#8f93a3] md:text-[14px] md:leading-7">
            Making blockchain intuitive and crypto social. Built for the Starknet ecosystem.
          </p>
          <div className="mt-4 flex gap-2">
            {["TW", "IG", "GH"].map((item) => (
              <a key={item} href="#" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#232733] text-[8px] text-[#8f93a3]">
                {item}
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[8px] font-bold tracking-[0.18em] text-white md:text-[12px]">{group.title}</h3>
              <div className="mt-3 grid gap-2">
                {group.links.map((link) => (
                  <a key={link} href="#" className="text-[10px] text-[#8f93a3] md:text-[14px]">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-350 flex-col gap-2 border-t border-[#10131a] pt-4 text-[9px] text-[#6f7486] md:flex-row md:items-center md:justify-between md:text-[13px]">
        <p>(c) 2026 StarkFlow Inc. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#">Network Status</a>
          <a href="#">Cookies</a>
          <a href="#">Settings</a>
        </div>
      </div>
    </footer>
  );
}
