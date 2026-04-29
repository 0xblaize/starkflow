export type AppSection = "dashboard" | "move" | "predict" | "me";
export type AppNavIcon = "home" | "move" | "predict" | "user";

export const appNavItems = [
  { id: "dashboard", label: "Home", href: "/dashboard", icon: "home" },
  { id: "move", label: "Move", href: "/move", icon: "move" },
  { id: "predict", label: "Predict", href: "/predict", icon: "predict" },
  { id: "me", label: "Me", href: "/me", icon: "user" },
] as const satisfies ReadonlyArray<{
  id: AppSection;
  label: string;
  href: string;
  icon: AppNavIcon;
}>;

export function getAppNav(current: AppSection) {
  return appNavItems.map((item) => ({
    ...item,
    active: item.id === current,
  }));
}
