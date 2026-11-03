import { describe, expect, it } from "vitest";

import { AI_LIMITS, checkRate } from "@/lib/limits";

describe("AI rate limits", () => {
  it("blocks at 50 requests per day", () => {
    expect(AI_LIMITS.requestsPerDay).toBe(50);
    expect(checkRate(0, 49).ok).toBe(true);
    expect(checkRate(0, 50).ok).toBe(false);
  });
  it("blocks at 6 requests per minute", () => {
    expect(checkRate(5, 10).ok).toBe(true);
    expect(checkRate(6, 10).ok).toBe(false);
  });
});
