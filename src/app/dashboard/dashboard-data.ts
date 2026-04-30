export const tokenTickers = [
  {
    symbol: "strkBTC",
    balance: "0.0000",
    network: "Testnet",
    note: "Vault balance",
  },
  {
    symbol: "STRK",
    balance: "0.0000",
    network: "Testnet",
    note: "Wallet balance",
  },
  {
    symbol: "USDC",
    balance: "0.00",
    network: "Testnet",
    note: "Stable",
  },
  {
    symbol: "BTC",
    balance: "0.0000",
    network: "Standby",
    note: "Bridge queue",
  },
] as const;
export type TokenTicker = (typeof tokenTickers)[number];

export const onchainAssets = [
  {
    name: "starkBTC",
    symbol: "strkBTC",
    iconSrc: "/tokens/strkbtc.svg",
    network: "Testnet",
    balance: "0.0000",
    status: "No deposit settled yet",
   
  },
  {
    name: "STARKNET",
    symbol: "STRK",
    iconSrc: "/tokens/strk.svg",
    network: "Testnet",
    balance: "0.0000",
    status: "Waiting for first transfer",
    
  },
  {
    name: "USDC",
    symbol: "USDC",
    iconSrc: "/tokens/usdc.svg",
    network: "Testnet",
    balance: "0.00",
    status: "Stable route empty",
   
  },
  {
    name: "BITCOIN",
    symbol: "BTC",
    iconSrc: "/tokens/btc.svg",
    network: "Standby",
    balance: "0.0000",
    status: "Bridge flow inactive",
    
  },
] as const;
export type OnchainAsset = (typeof onchainAssets)[number];

export const dashboardTabs = [
  { label: "Home", href: "/dashboard", icon: "home", active: true },
  { label: "Move", href: "/move", icon: "move", active: false },
  { label: "Predict", href: "/predict", icon: "predict", active: false },
  { label: "Me", href: "/me", icon: "user", active: false },
] as const;
export type DashboardTab = (typeof dashboardTabs)[number];

export const feedEmptyStates = [
  "No deposits have settled into this wallet yet.",
  "Bridge fills, prediction orders, and vault activity will appear here after live onchain execution.",
  "Zero means zero until the connected Starknet address really moves money.",
] as const;
