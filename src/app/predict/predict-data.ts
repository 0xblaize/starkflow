export const mobilePredictSummary = [
  { label: "Available Liquidity", value: "$0.00" },
  { label: "Active Hedges", value: "00" },
] as const;

export const marketCards = [
  {
    category: "Crypto Hedge",
    title: "ETH > $3,200 by Friday",
    description:
      "Set a simple hedge around ETH price movement once live oracle pricing is connected.",
    timeframe: "Awaiting oracle",
    state: "Pending",
  },
  {
    category: "Starknet Ecosystem",
    title: "STRK < $0.85 by EOD",
    description:
      "Track a Starknet-native outcome with readable execution, no wallet pop-up spam, and gasless settlement rails.",
    timeframe: "Market staging",
    state: "Pending",
  },
  {
    category: "Volatility Hedge",
    title: "BTC Volatility Surge",
    description:
      "Prepare for event-driven BTC movement with a clean YES or NO hedge when oracle and execution rails go live.",
    timeframe: "Feed not live",
    state: "Pending",
  },
] as const;

export const predictSteps = [
  {
    number: "1",
    title: "Pick Your Hedge",
    body: "Choose the market that matches the movement or transaction cost you want to protect against.",
  },
  {
    number: "2",
    title: "Session-Key Auth",
    body: "Approve once and StarkFlow can execute your market action later without repeated wallet interruptions.",
  },
  {
    number: "3",
    title: "Automatic Settlement",
    body: "Once the live rails are connected, resolution can settle directly to your Starknet wallet with sponsored gas.",
  },
] as const;

export const globalFeedItems = [
  {
    title: "Oracle feed pending",
    body: "The public market tape will appear here once the first live market stream is connected.",
    time: "--",
  },
  {
    title: "No resolved markets yet",
    body: "Completed outcomes and settlement highlights will populate after the prediction engine goes live.",
    time: "--",
  },
  {
    title: "Execution rail ready",
    body: "Session-key execution can be displayed here once the backend is attached to real market actions.",
    time: "Now",
  },
] as const;
