import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileSearch, ListChecks, ShieldCheck, Workflow, Bot } from "lucide-react";

import { PublicLayout } from "@/components/site/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXORA AI — From intention to execution" },
      { name: "description", content: "An AI agent workspace that plans, executes approved tools, and reports back with a full audit trail." },
      { property: "og:title", content: "NEXORA AI — From intention to execution" },
      { property: "og:description", content: "Plan, execute and verify work with a controlled AI agent workspace." },
    ],
  }),
  component: Landing,
});

const lifecycle = ["Goal", "Plan", "Validate", "Execute", "Verify", "Report"];

const pillars = [
  { icon: Bot, title: "Agent workspace", body: "Streaming AI conversations saved to your account, organised by project." },
  { icon: ListChecks, title: "Tasks & projects", body: "Keep goals, instructions and to-dos together in explicit, editable context." },
  { icon: ShieldCheck, title: "Approval-first autonomy", body: "Risky actions wait for your sign-off. Every step is logged." },
  { icon: FileSearch, title: "Document intelligence", body: "Grounded answers from your own files, with sources. (In development)" },
  { icon: Workflow, title: "Visual workflows", body: "Chain AI, search and approval steps into runnable flows. (In development)" },
];

function Landing() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-brand opacity-25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 text-center sm:pt-28">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-glow-cyan" /> AI agent workspace
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] sm:text-7xl">
            From intention <br className="hidden sm:block" />
            to <span className="text-gradient">execution.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            NEXORA turns a goal into a plan, runs the steps you allow, and tells you honestly what got done —
            and what didn't.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/features">See how it works</Link>
            </Button>
          </div>

          <div className="glass mx-auto mt-16 max-w-4xl rounded-2xl p-6 text-left shadow-glow">
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">run · lifecycle</span>
              <span className="font-mono">every step logged</span>
            </div>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              {lifecycle.map((s, i) => (
                <li key={s} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
                  <div className="mt-1 font-display font-medium">{s}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
          <div className="rounded-2xl bg-gradient-brand p-6 text-primary-foreground">
            <h3 className="text-lg font-semibold">Honest by design</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {["Completed vs. proposed actions are always separated", "No fake integrations", "Your data stays private to you"].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
