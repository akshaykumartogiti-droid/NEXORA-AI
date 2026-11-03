import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/history")({ component: HistoryPage });

const PAGE = 25;

function HistoryPage() {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["history", page, q],
    queryFn: async () => {
      let query = supabase.from("conversations").select("id, title, updated_at, created_at", { count: "exact" }).order("updated_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (q.trim()) query = query.ilike("title", `%${q.trim().replace(/[%_]/g, "")}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));
  return (
    <div>
      <PageHeader title="History" description="Past conversations and agent runs." />
      <div className="space-y-4 p-6">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search by title…" className="max-w-sm" aria-label="Search conversations" />
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <ul className="max-w-3xl divide-y divide-border rounded-xl border border-border">
          {data?.rows.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing found.</li>}
          {data?.rows.map((c) => (
            <li key={c.id}>
              <Link to="/app/agent/$conversationId" params={{ conversationId: c.id }} className="flex justify-between gap-4 px-4 py-3 text-sm hover:bg-accent">
                <span className="truncate">{c.title}</span>
                <span className="shrink-0 text-muted-foreground">{new Date(c.updated_at).toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
        <AgentRuns />
      </div>
    </div>
  );
}

const runStatus: Record<string, string> = {
  running: "bg-accent text-accent-foreground",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function AgentRuns() {
  const [open, setOpen] = useState<string | null>(null);
  const { data: runs = [] } = useQuery({
    queryKey: ["runs"],
    queryFn: async () => (await supabase.from("agent_runs").select("id, goal, status, summary, error, started_at, finished_at").order("started_at", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: events = [] } = useQuery({
    queryKey: ["run-events", open],
    enabled: !!open,
    queryFn: async () => (await supabase.from("agent_run_events").select("id, kind, tool, input, output, created_at").eq("run_id", open!).order("created_at")).data ?? [],
  });
  return (
    <section className="max-w-3xl pt-6">
      <h2 className="mb-3 font-medium">Agent runs (latest 30)</h2>
      {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {runs.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className={`rounded px-2 py-0.5 text-xs ${runStatus[r.status] ?? ""}`}>{r.status}</span>
              <span className="min-w-0 flex-1 truncate">{r.goal}</span>
              <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
            </button>
            {open === r.id && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Run {r.id.slice(0, 8)} · {r.finished_at ? `finished ${new Date(r.finished_at).toLocaleTimeString()}` : "not finished"}
                  {r.error ? ` · ${r.error}` : ""}
                </p>
                {r.summary && <p className="text-xs">{r.summary}</p>}
                {events.length === 0 && <p className="text-xs text-muted-foreground">No tool steps — text-only answer.</p>}
                {events.map((e) => (
                  <div key={e.id} className="rounded-lg bg-muted p-2 font-mono text-xs">
                    <div className="font-semibold">{e.kind}{e.tool ? ` · ${e.tool}` : ""}</div>
                    <div className="truncate">in: {JSON.stringify(e.input)}</div>
                    <div className="truncate">out: {JSON.stringify(e.output)}</div>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
