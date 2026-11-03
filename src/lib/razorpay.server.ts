// Server-only Razorpay helpers. Secrets are read per call and never returned.
const API = "https://api.razorpay.com/v1";

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Razorpay Checkout: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  return safeEqual(await hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

// Webhooks: signature = HMAC_SHA256(raw_body, webhook_secret)
export async function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature || !webhookSecret) return false;
  return safeEqual(await hmacHex(webhookSecret, rawBody), signature);
}

export function razorpayConfig() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) return null;
  const mode: "test" | "live" = keyId.startsWith("rzp_live_") ? "live" : "test";
  return { keyId, keySecret, mode };
}

export async function razorpayApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const cfg = razorpayConfig();
  if (!cfg) throw new Error("Payments are not configured.");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${btoa(`${cfg.keyId}:${cfg.keySecret}`)}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : null,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("Razorpay API error", path.split("/")[1], res.status);
    throw new Error(res.status === 401 ? "Payment provider rejected the credentials." : "Payment provider request failed.");
  }
  return (await res.json()) as T;
}

export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; error_description?: string | null };
