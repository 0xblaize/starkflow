export const personalStats = [
  { label: "Total Yield", value: "$0.00", accent: "+0" },
  { label: "Gas Saved", value: "$0.00", accent: "+0" },
] as const;

export const quickStats = [
  { label: "Total Gas Saved", value: "$0.00" },
  { label: "Transactions", value: "0" },
  { label: "StarkFlow Score", value: "Pending" },
] as const;

export const accountLinks = [
  {
    title: "Security Center",
    subtitle: "2FA, biometrics and recovery",
    status: "Secure",
    icon: "shield",
  },
  {
    title: "Auth Providers",
    subtitle: "Google connected, X paused",
    status: "Review",
    icon: "user",
  },
] as const;

export const preferenceLinks = [
  {
    title: "Gas Sponsorship",
    subtitle: "Always prioritize free transfers",
    icon: "bolt",
  },
  {
    title: "App Settings",
    subtitle: "Language, time and currencies",
    icon: "gear",
  },
] as const;

export const supportLinks = [
  {
    title: "Legal & Privacy",
    subtitle: "Terms, policy and app permissions",
    icon: "doc",
  },
] as const;

export const resources = ["Documentation", "Starknet Explorer", "Help Center"] as const;
export const legalLinks = ["Terms of Service", "Privacy Policy", "Compliance"] as const;
