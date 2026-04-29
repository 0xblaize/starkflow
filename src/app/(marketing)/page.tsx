import {
  CtaSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  MarketingFooter,
  MarketingNav,
  StatsSection,
} from "./landing-ui";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(47,84,255,0.12),transparent_24%),#050608] text-white">
      <div className="min-h-screen w-full bg-[#050608]/95">
        <MarketingNav />
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CtaSection />
        <MarketingFooter />
      </div>
    </main>
  );
}
