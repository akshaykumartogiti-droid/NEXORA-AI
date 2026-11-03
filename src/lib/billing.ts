// Browser-safe plan catalogue. The server reads prices from here too, so the
// browser never decides what a plan costs.
// NOTE: Pro price/limits are defaults chosen during setup — confirm with the owner.
export const PLANS = {
  free: { label: "Starter", requestsPerDay: 50 },
  pro: { label: "Pro", amountPaise: 159_900, currency: "INR", periodDays: 30, requestsPerDay: 500 },
} as const;

export type PaidPlan = "pro";

export function formatINR(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

// Daily AI request allowance for a user, given their entitlement row (if any).
export function dailyLimitFor(ent: { plan: string; expires_at: string } | null | undefined, now = new Date()) {
  if (ent && ent.plan === "pro" && new Date(ent.expires_at) > now) return PLANS.pro.requestsPerDay;
  return PLANS.free.requestsPerDay;
}
