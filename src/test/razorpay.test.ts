// @vitest-environment node
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { razorpayConfig, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay.server";

vi.stubGlobal("crypto", webcrypto);
afterEach(() => vi.unstubAllEnvs());
async function signature(secret: string, body: string) {
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString("hex");
}
describe("Razorpay security", () => {
  it("accepts valid signatures and rejects forged/mismatched payments", async () => {
    const secret = "test-only-not-a-provider-key";
    const sig = await signature(secret, "order_test|pay_test");
    expect(await verifyCheckoutSignature("order_test", "pay_test", sig, secret)).toBe(true);
    expect(await verifyCheckoutSignature("order_other", "pay_test", sig, secret)).toBe(false);
    expect(await verifyCheckoutSignature("order_test", "pay_test", "0".repeat(64), secret)).toBe(false);
  });
  it("verifies the exact raw webhook body", async () => {
    const body = '{"event":"payment.captured"}';
    const sig = await signature("test-only-webhook", body);
    expect(await verifyWebhookSignature(body, sig, "test-only-webhook")).toBe(true);
    expect(await verifyWebhookSignature(body + " ", sig, "test-only-webhook")).toBe(false);
  });
  it.each(["test", "live"] as const)("supports %s mode", (mode) => {
    vi.stubEnv("RAZORPAY_KEY_ID", `rzp_${mode}_test_fixture`);
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test-only-not-a-provider-key");
    expect(razorpayConfig()?.mode).toBe(mode);
  });
});