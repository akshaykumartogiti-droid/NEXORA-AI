import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLayout } from "@/components/site/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — NEXORA AI" },
      { name: "description", content: "Illustrative NEXORA AI plans. Billing is not active yet." },
      { property: "og:title", content: "Pricing — NEXORA AI" },
      { property: "og:description", content: "Illustrative plans for the NEXORA AI workspace." },
    ],
  }),
  component: Pricing,
});

const plans = [
  { name: "Starter", price: "$0", features: ["50 AI requests / day (enforced)", "Projects & tasks", "Conversation history"], highlight: false },
  { name: "Pro", price: "$19", features: ["Higher limits", "Knowledge base", "Workflow builder"], highlight: true },
  { name: "Team", price: "$49", features: ["Shared workspaces", "Approval policies", "Audit exports"], highlight: false },
];

function Pricing() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h1 className="text-center text-4xl font-semibold sm:text-5xl">Simple plans</h1>
        <p role="note" className="mx-auto mt-4 max-w-xl rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-center text-sm">
          Illustrative only — billing is not active. Everyone currently uses the free Starter limits.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl border p-6 ${p.highlight ? "border-primary shadow-glow" : "border-border"} bg-card`}>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <div className="mt-3 font-display text-4xl font-semibold">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground"> /month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {p.name === "Starter" ? (
                <Button asChild className="mt-6 w-full bg-gradient-brand text-primary-foreground">
                  <Link to="/auth" search={{ mode: "signup" }}>Start free</Link>
                </Button>
              ) : (
                <Button className="mt-6 w-full" variant="outline" disabled>
                  Not available yet
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
