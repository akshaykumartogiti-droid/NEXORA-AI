import { createFileRoute } from "@tanstack/react-router";

import { PublicLayout } from "@/components/site/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy (draft) — NEXORA AI" },
      { name: "description", content: "Draft privacy policy placeholder for NEXORA AI." },
      { property: "og:title", content: "Privacy Policy (draft) — NEXORA AI" },
      { property: "og:description", content: "Draft privacy policy placeholder." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-20">
        <p className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-sm">
          PLACEHOLDER — must be reviewed by a qualified professional before commercial launch.
        </p>
        <h1 className="mt-6 text-4xl font-semibold">Privacy Policy</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>We store your account email, profile name, conversations, projects, tasks and AI usage records so the service works.</p>
          <p>Your content is private to your account and is not used as public or shared training data by NEXORA.</p>
          <p>Messages you send to the assistant are processed by our AI model provider to generate responses.</p>
          <p>You can delete conversations, projects and tasks at any time from the app.</p>
        </div>
      </article>
    </PublicLayout>
  ),
});
