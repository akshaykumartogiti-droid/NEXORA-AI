// Single public catalogue used by both display and authoritative server checkout.
// Entitlements/order snapshots preserve purchased allowances when prices change.
export const PLANS = {
  starter: { label: "Starter", amountPaise: 15_000, currency: "INR", periodDays: 30, requestsPerDay: 50, benefit: "Everyday questions and light AI work" },
  basic: { label: "Basic", amountPaise: 25_000, currency: "INR", periodDays: 30, requestsPerDay: 100, benefit: "More room for regular research and writing" },
  pro: { label: "Pro", amountPaise: 50_000, currency: "INR", periodDays: 30, requestsPerDay: 250, benefit: "A balanced allowance for daily professional work" },
  premium: { label: "Premium", amountPaise: 150_000, currency: "INR", periodDays: 30, requestsPerDay: 1000, benefit: "Our largest allowance for intensive AI work" },
} as const;

export const PAID_PLAN_IDS = ["starter", "basic", "pro", "premium"] as const;
export type PaidPlan = typeof PAID_PLAN_IDS[number];
export const FREE_DAILY_LIMIT = 50; // Preserve existing non-subscriber access.
export type Entitlement = { plan: string; expires_at: string; requests_per_day?: number | null };

export function activeSubscription(ent: Entitlement | null | undefined, now = new Date()) {
  return Boolean(ent && new Date(ent.expires_at) > now);
}

// India calendar days, not a rolling 24-hour window. Same boundary as SQL.
export function usageDayStart(now = new Date()) {
  const offset = 330 * 60_000;
  const local = new Date(now.getTime() + offset);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset);
}

export function formatINR(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

// Daily AI request allowance for a user, given their entitlement row (if any).
export function dailyLimitFor(ent: Entitlement | null | undefined, now = new Date()) {
  if (!ent || !activeSubscription(ent, now)) return FREE_DAILY_LIMIT;
  if (ent.requests_per_day != null) return ent.requests_per_day;
  // Old Pro purchases remain at their original 500/day until expiry.
  if (ent.plan === "pro") return 500;
  return PAID_PLAN_IDS.includes(ent.plan as PaidPlan) ? PLANS[ent.plan as PaidPlan].requestsPerDay : FREE_DAILY_LIMIT;
}
