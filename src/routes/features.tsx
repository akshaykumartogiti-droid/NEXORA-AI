import { createFileRoute } from "@tanstack/react-router";

import { PublicLayout } from "@/components/site/brand";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — NEXORA AI" },
      { name: "description", content: "What NEXORA AI can do today and what is still in development." },
      { property: "og:title", content: "Features — NEXORA AI" },
      { property: "og:description", content: "Agent workspace, projects, tasks, usage tracking and more." },
    ],
  }),
  component: Features,
});

const available = [
  ["AI conversation workspace", "Streaming answers, saved conversations, rename, delete, copy and retry."],
  ["Projects", "Group work with editable project instructions the agent reads."],
  ["Tasks", "Create, update and complete personal tasks."],
  ["Usage tracking", "Every AI request recorded with token counts and daily limits."],
  ["Secure accounts", "Email and Google sign-in; every record is private to its owner."],
];
const coming = [
  ["Agent tools & runs", "Plan → execute → verify lifecycle with an event log."],
  ["Approvals", "Queue for actions that need your sign-off."],
  ["Knowledge base", "Upload documents and get source-backed answers."],
  ["Workflow builder", "Visual, runnable node-based automations."],
];
const useCases = ["Research briefs from a single goal", "Turning meeting notes into tasks", "Drafting plans and documents per project", "Keeping a searchable history of AI work"];

function Features() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h1 className="text-4xl font-semibold sm:text-5xl">
          What NEXORA <span className="text-gradient">does today</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">We label everything honestly: live features below, in-development features after.</p>

        <h2 className="mt-12 text-xl font-semibold">Available now</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {available.map(([t, b]) => (
            <div key={t} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-medium">
                <span className="size-2 rounded-full bg-success" /> {t}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold">In development</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {coming.map(([t, b]) => (
            <div key={t} className="rounded-xl border border-dashed border-border p-5">
              <div className="flex items-center gap-2 font-medium">
                <span className="size-2 rounded-full bg-warning" /> {t}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold">Use cases</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {useCases.map((u) => (
            <li key={u} className="glass rounded-lg px-4 py-3 text-sm">{u}</li>
          ))}
        </ul>
      </div>
    </PublicLayout>
  );
}
