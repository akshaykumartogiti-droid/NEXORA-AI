import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, dailyLimitFor, formatINR } from "@/lib/billing";
import { createCheckoutOrder, markCheckoutFailed, verifyCheckoutPayment } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/app/billing")({
  head: () => ({ meta: [{ title: "Billing — NEXORA AI" }] }),
  component: Billing,
});

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpInstance = { open: () => void; on: (ev: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => RzpInstance }
}

function loadCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type Phase = { kind: "idle" } | { kind: "working"; text: string } | { kind: "success"; until: string } | { kind: "error"; text: string };

function Billing() {
  const qc = useQueryClient();
  const createOrder = useServerFn(createCheckoutOrder);
  const verify = useServerFn(verifyCheckoutPayment);
  const markFailed = useServerFn(markCheckoutFailed);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const { data: ent, refetch: refetchEnt } = useQuery({
    queryKey: ["entitlement"],
    queryFn: async () => (await supabase.from("entitlements").select("plan, expires_at").maybeSingle()).data,
  });
  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments")
        .select("id, plan, amount_paise, currency, status, mode, razorpay_order_id, razorpay_payment_id, failure_reason, period_end, created_at")
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  const isPro = dailyLimitFor(ent) === PLANS.pro.requestsPerDay;
  const refresh = async () => { await Promise.all([refetchEnt(), refetchPayments()]); qc.invalidateQueries({ queryKey: ["usage"] }); };

  const buy = async () => {
    if (phase.kind === "working") return;
    setPhase({ kind: "working", text: "Preparing secure checkout…" });
    try {
      if (!(await loadCheckout()) || !window.Razorpay) {
        setPhase({ kind: "error", text: "Could not load Razorpay Checkout. Check your connection and try again." });
        return;
      }
      const order = await createOrder({ data: { plan: "pro" } });
      if (!order.ok) { setPhase({ kind: "error", text: order.error }); return; }
      let settled = false;
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "NEXORA AI",
        description: `Pro — ${PLANS.pro.periodDays} days`,
        prefill: { email: order.email },
        theme: { color: "#7c5cff" },
        handler: async (r: RzpResponse) => {
          settled = true;
          setPhase({ kind: "working", text: "Verifying your payment…" });
          try {
            const v = await verify({ data: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } });
            await refresh();
            if (v.ok) {
              const { data } = await supabase.from("entitlements").select("expires_at").maybeSingle();
              setPhase({ kind: "success", until: data?.expires_at ?? "" });
            } else setPhase({ kind: "error", text: v.error });
          } catch {
            setPhase({ kind: "error", text: "We couldn't confirm the payment due to a network problem. If money was deducted, your plan activates automatically within a few minutes — refresh this page." });
          }
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            markFailed({ data: { orderId: order.orderId, reason: "Cancelled by user" } }).catch(() => {});
            setPhase({ kind: "error", text: "Payment cancelled. You were not charged." });
            refetchPayments();
          },
        },
      });
      rzp.on("payment.failed", (r) => {
        markFailed({ data: { orderId: order.orderId, reason: (r.error?.description ?? "Payment failed").slice(0, 200) } }).catch(() => {});
        setPhase({ kind: "error", text: `Payment failed: ${r.error?.description ?? "unknown reason"}. You can try again with another method.` });
      });
      rzp.open();
      setPhase({ kind: "working", text: "Complete the payment in the Razorpay window…" });
    } catch (e) {
      setPhase({ kind: "error", text: e instanceof Error ? e.message : "Checkout failed. Please try again." });
      toast.error("Checkout failed");
    }
  };

  return (
    <div>
      <PageHeader title="Billing" description="Your plan, payments and receipts. Payments are processed securely by Razorpay." />
      <div className="max-w-3xl space-y-6 p-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-2xl font-semibold">{isPro ? "Pro" : "Starter (free)"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {dailyLimitFor(ent)} AI requests per day
            {isPro && ent ? ` · active until ${new Date(ent.expires_at).toLocaleString()}` : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-primary bg-card p-5 shadow-glow">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Pro</h2>
            <p className="font-display text-3xl font-semibold">{formatINR(PLANS.pro.amountPaise)}<span className="text-sm font-normal text-muted-foreground"> / {PLANS.pro.periodDays} days</span></p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{PLANS.pro.requestsPerDay} AI requests per day for {PLANS.pro.periodDays} days. One-time payment, no auto-renewal. Buying again adds {PLANS.pro.periodDays} more days.</p>
          <Button className="mt-4 w-full sm:w-auto" onClick={buy} disabled={phase.kind === "working"}>
            {phase.kind === "working" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {isPro ? "Extend Pro" : "Upgrade to Pro"}
          </Button>
          <div aria-live="polite" className="mt-3 text-sm">
            {phase.kind === "working" && <p className="text-muted-foreground">{phase.text}</p>}
            {phase.kind === "error" && <p className="text-destructive">{phase.text}</p>}
            {phase.kind === "success" && (
              <p className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" /> Payment verified — Pro is active{phase.until ? ` until ${new Date(phase.until).toLocaleString()}` : ""}.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Payments & receipts</h2>
          {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          <ul className="divide-y divide-border rounded-xl border border-border">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{formatINR(p.amount_paise)}</span>
                <span className={p.status === "paid" ? "text-success" : p.status === "created" ? "text-muted-foreground" : "text-destructive"}>
                  {p.status === "created" ? (p.failure_reason ? "not completed" : "pending") : p.status}
                </span>
                {p.mode === "test" && <span className="rounded bg-warning/15 px-1.5 text-xs text-warning">test mode</span>}
                <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</span>
                <span className="w-full font-mono text-xs text-muted-foreground">
                  Order {p.razorpay_order_id}{p.razorpay_payment_id ? ` · Payment ${p.razorpay_payment_id}` : ""}
                  {p.period_end ? ` · covers until ${new Date(p.period_end).toLocaleDateString()}` : ""}
                  {p.failure_reason && p.status !== "paid" ? ` · ${p.failure_reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
