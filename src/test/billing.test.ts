import { describe, expect, it } from "vitest";
import { PLANS, dailyLimitFor, usageDayStart } from "@/lib/billing";
import { checkRate } from "@/lib/limits";

describe("subscription rules", () => {
  it.each([
    ["starter", 15000, 50], ["basic", 25000, 100], ["pro", 50000, 250], ["premium", 150000, 1000],
  ] as const)("%s price, 30-day validity and daily limit", (id, amount, limit) => {
    expect(PLANS[id].amountPaise).toBe(amount);
    expect(PLANS[id].periodDays).toBe(30);
    expect(PLANS[id].currency).toBe("INR");
    expect(PLANS[id].requestsPerDay).toBe(limit);
    const ent = { plan: id, expires_at: "2026-12-01T00:00:00Z", requests_per_day: limit };
    expect(dailyLimitFor(ent, new Date("2026-11-08T00:00:00Z"))).toBe(limit);
    expect(checkRate(0, limit - 1, limit).ok).toBe(true);
    expect(checkRate(0, limit, limit).ok).toBe(false);
  });
  it("preserves purchased legacy Pro allowance", () => {
    expect(dailyLimitFor({ plan: "pro", expires_at: "2026-12-01T00:00:00Z", requests_per_day: 500 }, new Date("2026-11-08"))).toBe(500);
  });
  it("expires at the exact subscription boundary", () => {
    const ent = { plan: "premium", expires_at: "2026-12-08T00:00:00Z", requests_per_day: 1000 };
    expect(dailyLimitFor(ent, new Date("2026-12-07T23:59:59Z"))).toBe(1000);
    expect(dailyLimitFor(ent, new Date(ent.expires_at))).toBe(50);
  });
  it("resets the calendar day at midnight India time", () => {
    expect(usageDayStart(new Date("2026-11-08T18:29:59Z")).toISOString()).toBe("2026-11-07T18:30:00.000Z");
    expect(usageDayStart(new Date("2026-11-08T18:30:00Z")).toISOString()).toBe("2026-11-08T18:30:00.000Z");
  });
});