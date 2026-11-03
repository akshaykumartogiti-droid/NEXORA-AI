import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/lib/billing";

// Creates a Razorpay order for a plan. The price comes only from server config.
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.literal("pro") }).parse(d))
  .handler(async ({ data, context }) => {
    const { razorpayApi, razorpayConfig } = await import("@/lib/razorpay.server");
    const cfg = razorpayConfig();
    if (!cfg) return { ok: false as const, error: "Payments are not set up yet. Please try again later." };
    const plan = PLANS[data.plan];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Limit abandoned orders: max 10 unpaid orders per user per hour.
    const { count } = await supabaseAdmin.from("payments").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("status", "created").gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= 10) return { ok: false as const, error: "Too many checkout attempts. Please wait a while and try again." };

    const order = await razorpayApi<{ id: string; amount: number; currency: string }>("/orders", {
      method: "POST",
      body: { amount: plan.amountPaise, currency: plan.currency, receipt: `nx_${Date.now()}`, notes: { user_id: context.userId, plan: data.plan } },
    });
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId, plan: data.plan, amount_paise: plan.amountPaise, currency: plan.currency,
      period_days: plan.periodDays, mode: cfg.mode, razorpay_order_id: order.id,
    });
    if (error) return { ok: false as const, error: "Could not start checkout. Please try again." };
    return { ok: true as const, keyId: cfg.keyId, orderId: order.id, amount: order.amount, currency: order.currency, mode: cfg.mode, email: (context.claims as { email?: string }).email ?? "" };
  });

const verifyInput = z.object({
  orderId: z.string().min(5).max(64),
  paymentId: z.string().min(5).max(64),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

// Verifies a checkout result: signature, ownership, then amount/currency/status
// fetched directly from Razorpay. Only then is the plan activated (once).
export const verifyCheckoutPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { razorpayApi, razorpayConfig, verifyCheckoutSignature } = await import("@/lib/razorpay.server");
    const cfg = razorpayConfig();
    if (!cfg) return { ok: false as const, error: "Payments are not set up." };
    if (!(await verifyCheckoutSignature(data.orderId, data.paymentId, data.signature, cfg.keySecret)))
      return { ok: false as const, error: "Payment could not be verified." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin.from("payments").select("user_id, amount_paise, currency, status, entitlement_applied_at")
      .eq("razorpay_order_id", data.orderId).maybeSingle();
    if (!pay || pay.user_id !== context.userId) return { ok: false as const, error: "Payment could not be verified." };
    if (pay.entitlement_applied_at) return { ok: true as const, status: "already_applied" };

    let rp = await razorpayApi<{ id: string; order_id: string; amount: number; currency: string; status: string }>(`/payments/${encodeURIComponent(data.paymentId)}`);
    if (rp.order_id !== data.orderId || rp.amount !== pay.amount_paise || rp.currency !== pay.currency)
      return { ok: false as const, error: "Payment details did not match the order." };
    if (rp.status === "authorized") {
      // Capture if the account is not set to auto-capture.
      rp = await razorpayApi(`/payments/${encodeURIComponent(data.paymentId)}/capture`, { method: "POST", body: { amount: pay.amount_paise, currency: pay.currency } });
    }
    if (rp.status !== "captured") return { ok: false as const, error: "Payment is not complete yet. If money was deducted, it will be confirmed shortly." };

    const { data: res, error } = await supabaseAdmin.rpc("apply_verified_payment", { _order_id: data.orderId, _payment_id: data.paymentId, _via: "checkout" });
    if (error) return { ok: false as const, error: "Payment received but activation failed. It will be retried automatically." };
    return { ok: true as const, status: res as string };
  });

// Records a failed/cancelled checkout for the user's own order (status only; grants nothing).
export const markCheckoutFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().min(5).max(64), reason: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update({ failure_reason: data.reason, updated_at: new Date().toISOString() })
      .eq("razorpay_order_id", data.orderId).eq("user_id", context.userId).eq("status", "created");
    return { ok: true };
  });
