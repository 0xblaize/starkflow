export const moveTabs = [
  { label: "Home", href: "/dashboard", icon: "home", active: false },
  { label: "Move", href: "/move", icon: "move", active: true },
  { label: "Predict", href: "/predict", icon: "predict", active: false },
  { label: "Me", href: "/me", icon: "user", active: false },
] as const;
export type MoveTab = (typeof moveTabs)[number];

export const programs = [
  {
    title: "DCA Strategy",
    badge: "Coming Soon",
    description:
      "Set up recurring buys like 10 USDC into STRK every Monday once the automation rail is connected.",
    footer: "Scheduled execution via StarkZap routes",
    icon: "dca",
  },
  {
    title: "Yield Loop",
    badge: "Coming Soon",
    description:
      "One-click route into the Vesu lending loop when wallet assets are live and ready to deploy.",
    footer: "Yield is shown only after real positions exist",
    icon: "yield",
  },
] as const;
export type ProgramCard = (typeof programs)[number];

export const helpItems = [
  {
    title: "What is Gasless Send?",
    body: "StarkFlow will sponsor supported send routes after the live paymaster rail is connected.",
  },
  {
    title: "Sending by username or address",
    body: "Search by Starknet username or paste a wallet address. No recipient appears until a live lookup succeeds.",
  },
  {
    title: "Bridge BTC support",
    body: "The WalletConnect BTC bridge rail stays idle until the BTC bridge connector is enabled.",
  },
] as const;
