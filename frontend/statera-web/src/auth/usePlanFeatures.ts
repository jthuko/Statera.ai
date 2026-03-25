import { useContext } from "react";
import { AuthContext } from "./AuthContext";

const GROWTH_TIERS = new Set(["Growth", "Scale", "Enterprise"]);
const SCALE_TIERS  = new Set(["Scale", "Enterprise"]);

export function usePlanFeatures() {
  const ctx = useContext(AuthContext);
  const user = ctx?.user;

  const isGrowthPlus =
    user?.planStatus === "Trial" ||
    GROWTH_TIERS.has(user?.planTier ?? "");

  const isScalePlus =
    user?.planStatus === "Trial" ||
    SCALE_TIERS.has(user?.planTier ?? "");

  return { isGrowthPlus, isScalePlus };
}
