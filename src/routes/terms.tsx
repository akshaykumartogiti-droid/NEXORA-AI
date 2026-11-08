import { createFileRoute } from "@tanstack/react-router";

import { PublicLayout } from "@/components/site/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service (draft) — NEXORA AI" },
      { name: "description", content: "Draft terms of service placeholder for NEXORA AI." },
      { property: "og:title", content: "Terms of Service (draft) — NEXORA AI" },
      { property: "og:description", content: "Draft terms of service placeholder." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-20">
        <p className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-sm">
          PLACEHOLDER — must be reviewed by a qualified professional before commercial launch.
        </p>
        <h1 className="mt-6 text-4xl font-semibold">Terms of Service</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>NEXORA AI is provided as-is during early access. AI output can be wrong; verify important results.</p>
          <p>Do not use the service for unlawful activity or to abuse its AI limits.</p>
          <p>Paid plans activate only after payment verification and remain valid for 30 days from activation. A new purchase replaces the current plan and starts a new 30-day period. Payments do not auto-renew. Daily AI allowances reset at midnight India time.</p>
        </div>
      </article>
    </PublicLayout>
  ),
});
