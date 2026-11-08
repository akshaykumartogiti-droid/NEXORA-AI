import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, PAID_PLAN_IDS, activeSubscription, dailyLimitFor, formatINR, type PaidPlan } from "@/lib/billing";
import { createCheckoutOrder, markCheckoutFailed, verifyCheckoutPayment } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/app/billing")({
  validateSearch: z.object({ plan: z.enum(PAID_PLAN_IDS).optional() }),
  head: () => ({ meta: [{ title: "Billing — NEXORA AI" }, { name: "description", content: "Manage your NEXORA AI subscription and Razorpay payments." }, { property: "og:title", content: "Billing — NEXORA AI" }, { property: "og:description", content: "Manage subscriptions and verified payments." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
  const { plan: selectedPlan } = Route.useSearch();
  const qc = useQueryClient();
  const createOrder = useServerFn(createCheckoutOrder);
  const verify = useServerFn(verifyCheckoutPayment);
  const markFailed = useServerFn(markCheckoutFailed);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const { data: ent, refetch: refetchEnt } = useQuery({
    queryKey: ["entitlement"],
    queryFn: async () => (await supabase.from("entitlements").select("plan, expires_at, requests_per_day").maybeSingle()).data,
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
  const subscribed = activeSubscription(ent);
  const refresh = async () => { await Promise.all([refetchEnt(), refetchPayments()]); qc.invalidateQueries({ queryKey: ["usage"] }); };

  const buy = async (planId: PaidPlan) => {
    const plan = PLANS[planId];
    if (phase.kind === "working") return;
    setPhase({ kind: "working", text: "Preparing secure checkout…" });
    try {
      if (!(await loadCheckout()) || !window.Razorpay) {
        setPhase({ kind: "error", text: "Could not load Razorpay Checkout. Check your connection and try again." });
        return;
      }
      const order = await createOrder({ data: { plan: planId } });
      if (!order.ok) { setPhase({ kind: "error", text: order.error }); return; }
      let settled = false;
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "NEXORA AI",
        description: `${plan.label} — ${plan.periodDays} days`,
        prefill: { email: order.email },
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
            setPhase({ kind: "error", text: "We couldn't confirm the payment due to a network problem. If money was deducted, refresh your payments to check its status." });
          }
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            markFailed({ data: { orderId: order.orderId, reason: "Cancelled by user" } }).catch(() => {});
            setPhase({ kind: "error", text: "Checkout closed. No subscription was activated. If payment was completed, verification may still be pending." });
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
          <p className="mt-1 font-display text-2xl font-semibold">{subscribed && ent ? (PAID_PLAN_IDS.includes(ent.plan as PaidPlan) ? PLANS[ent.plan as PaidPlan].label : ent.plan) : "Free access"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {dailyLimitFor(ent)} AI requests per day
            {subscribed && ent ? ` · active until ${new Date(ent.expires_at).toLocaleString()}` : ""}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">Each purchase activates immediately for 30 days and replaces the current plan. No auto-renewal. Daily allowances reset at midnight India time.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PAID_PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            return <div key={id} className={`rounded-lg border bg-card p-5 ${id === (selectedPlan ?? "pro") ? "border-primary" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{plan.label}</h2>{id === "pro" && <span className="text-xs font-medium text-primary">Recommended</span>}</div>
              <p className="mt-3 font-display text-3xl font-semibold">{formatINR(plan.amountPaise)}<span className="text-sm font-normal text-muted-foreground"> / 30 days</span></p>
              <p className="mt-3 text-sm">{plan.requestsPerDay.toLocaleString()} AI requests per day</p>
              <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.benefit}</p>
              <Button className="mt-4 w-full" variant={id === "pro" ? "default" : "outline"} onClick={() => buy(id)} disabled={phase.kind === "working" || phase.kind === "success"}>
                {phase.kind === "working" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Subscribe to {plan.label}
              </Button>
            </div>;
          })}
        </div>
        <div>
          <div aria-live="polite" className="mt-3 text-sm">
            {phase.kind === "working" && <p className="text-muted-foreground">{phase.text}</p>}
            {phase.kind === "error" && <p className="text-destructive">{phase.text}</p>}
            {phase.kind === "success" && (
              <p className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" /> Payment verified — your subscription is active{phase.until ? ` until ${new Date(phase.until).toLocaleString()}` : ""}.</p>
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
