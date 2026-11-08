import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLayout } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { PAID_PLAN_IDS, PLANS, formatINR } from "@/lib/billing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — NEXORA AI" },
      { name: "description", content: "Subscribe to NEXORA AI from ₹150 for 30 days. Compare Starter, Basic, Pro and Premium daily AI allowances." },
      { property: "og:title", content: "Pricing — NEXORA AI" },
      { property: "og:description", content: "Four paid plans from ₹150 for 30 days with verified Razorpay checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20">
        <p className="text-center text-sm font-medium text-primary">NEXORA AI · Subscriptions</p>
        <h1 className="mt-3 text-center text-4xl font-semibold sm:text-5xl">Plans for your AI workspace</h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-muted-foreground">Choose your daily allowance. Every plan includes 30 days of access, with a single payment and no auto-renewal.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PAID_PLAN_IDS.map((id) => {
            const p = PLANS[id];
            return <article key={id} className={`flex flex-col rounded-lg border bg-card p-6 ${id === "pro" ? "border-primary shadow-glow" : "border-border"}`}>
              <div className="h-6 text-xs font-semibold text-primary">{id === "pro" ? "RECOMMENDED" : "30-DAY SUBSCRIPTION"}</div>
              <h2 className="mt-3 text-xl font-semibold">{p.label}</h2>
              <p className="mt-4 font-display text-4xl font-semibold">{formatINR(p.amountPaise)}</p>
              <p className="mt-1 text-sm text-muted-foreground">for {p.periodDays} days</p>
              <p className="mt-6 text-lg font-semibold">{p.requestsPerDay.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AI requests / day</span></p>
              <p className="mt-3 min-h-16 text-sm leading-relaxed text-muted-foreground">{p.benefit}</p>
              <ul className="my-6 space-y-3 border-t border-border pt-5 text-sm">
                {["Projects & task management", "Saved conversation history", "Knowledge & workflows"].map((benefit) => <li key={benefit} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-success" />{benefit}</li>)}
              </ul>
              <Button asChild variant={id === "pro" ? "default" : "outline"} className="mt-auto w-full"><Link to="/auth" search={{ mode: "signin", plan: id }} aria-label={`Subscribe to ${p.label}`}>Subscribe <ArrowRight className="size-4" /></Link></Button>
            </article>;
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Secure Razorpay checkout · Activates after payment verification · Allowance resets at midnight India time</p>
      </div>
    </PublicLayout>
  );
}
