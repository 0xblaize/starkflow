export const NAV_LINKS = ["Product", "How it works", "Demo", "Docs"];

export const STATS = [
  { value: "$1.2B+", label: "TOTAL VOLUME" },
  { value: "$840K", label: "GAS SAVED" },
  { value: "4.2M", label: "TRANSACTIONS" },
  { value: "180K+", label: "IDENTITY HOLDERS" },
];

export const FEATURES = [
  {
    icon: "spark",
    title: "Zero-Friction",
    desc: "No browser extensions or complex setup. Sign in and start moving money immediately.",
  },
  {
    icon: "phone",
    title: "Gasless",
    desc: "Sponsored Starknet transactions remove the stress of tracking ETH for fees.",
  },
  {
    icon: "shield",
    title: "Seedless Security",
    desc: "Account abstraction gives users a safer recovery flow without seed phrase friction.",
  },
  {
    icon: "card",
    title: "Instant On-Ramp",
    desc: "Fund wallets with familiar payment rails and begin using assets in seconds.",
  },
  {
    icon: "users",
    title: "Shared Wallets",
    desc: "Create collaborative balances for teams, families, and community-driven flows.",
  },
  {
    icon: "globe",
    title: "Global Settlement",
    desc: "Send value globally with social identity and a cleaner settlement experience.",
  },
] as const;

export const STEPS = [
  {
    id: "01",
    title: "Connect Simply",
    desc: "Sign in with Google or Email. A secure wallet with gasless features is created automatically.",
  },
  {
    id: "02",
    title: "Deposit or On-ramp",
    desc: "Transfer from another wallet or use a card to buy crypto directly in the app.",
  },
  {
    id: "03",
    title: "Move & Spend",
    desc: "Send funds to any StarkFlow username instantly, zero gas fees, zero stress.",
  },
];

export const FOOTER_LINKS = [
  { title: "PRODUCT", links: ["Features", "Security", "Gasless SDK"] },
  { title: "LEGAL", links: ["Terms", "Privacy", "Cookies"] },
];

export type FeatureIconType = (typeof FEATURES)[number]["icon"];
