import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, CheckSquare, FolderKanban } from "lucide-react";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/")({ component: Overview });

function Overview() {
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [p, c, t, prof] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5),
        supabase.from("tasks").select("id, title, status").neq("status", "done").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("display_name").maybeSingle(),
      ]);
      return { projects: p.count ?? 0, convos: c.data ?? [], tasks: t.data ?? [], name: prof.data?.display_name };
    },
  });
  return (
    <div>
      <PageHeader
        title={`Welcome${data?.name ? `, ${data.name}` : ""}`}
        description="Your recent activity across NEXORA."
        actions={<Button asChild className="bg-gradient-brand text-primary-foreground"><Link to="/app/agent"><Bot className="size-4" /> Open agent</Link></Button>}
      />
      <div className="grid gap-4 p-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="font-medium">Recent conversations</h2>
          <ul className="mt-3 divide-y divide-border">
            {data?.convos.length === 0 && <li className="py-2 text-sm text-muted-foreground">None yet.</li>}
            {data?.convos.map((c) => (
              <li key={c.id}>
                <Link to="/app/agent/$conversationId" params={{ conversationId: c.id }} className="flex justify-between gap-4 py-2 text-sm hover:text-primary">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-4">
          <Link to="/app/projects" className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/50">
            <FolderKanban className="size-4 text-primary" />
            <div className="mt-2 font-display text-3xl font-semibold">{data?.projects ?? "–"}</div>
            <div className="text-sm text-muted-foreground">Projects</div>
          </Link>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-medium"><CheckSquare className="size-4 text-primary" /> Open tasks</div>
            <ul className="mt-2 space-y-1 text-sm">
              {data?.tasks.length === 0 && <li className="text-muted-foreground">All clear.</li>}
              {data?.tasks.map((t) => <li key={t.id} className="truncate">• {t.title}</li>)}
            </ul>
            <Link to="/app/tasks" className="mt-3 inline-block text-sm text-primary">View tasks</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
