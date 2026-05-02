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
    badge: "Live",
    description:
      "Create recurring Starknet buys through StarkZap and keep the live strategy ID synced to your profile data.",
    footer: "AVNU DCA execution on the active Starknet network",
    icon: "dca",
  },
  {
    title: "Yield Loop",
    badge: "Live",
    description:
      "Deposit supported assets into Vesu from StarkFlow and refresh live positions without leaving the app.",
    footer: "Vesu lending execution on the active Starknet network",
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
    title: "Bridge connector support",
    body: "Bridge routes in this build follow StarkZap's installed external connectors. Ethereum and Solana are available in-package.",
  },
] as const;
