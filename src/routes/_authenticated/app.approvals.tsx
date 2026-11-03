import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { decideApproval } from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/app/approvals")({ component: Approvals });

const statusClass: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  executed: "bg-success/15 text-success",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function Approvals() {
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("id, action, summary, payload, risk, status, result, created_at, decided_at, conversation_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const pending = data.filter((r) => r.status === "pending");
  const done = data.filter((r) => r.status !== "pending");

  const act = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    try {
      const res = await decide({ data: { id, decision } });
      if (res.status === "executed") toast.success("Approved and executed");
      else if (res.status === "rejected") toast.success("Rejected — nothing was changed");
      else toast.error(res.result ?? "Action failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  };

  return (
    <div>
      <PageHeader title="Approvals" description="Risky agent actions wait here. Nothing happens until you approve." />
      <div className="max-w-3xl space-y-8 p-6">
        <section>
          <h2 className="mb-3 font-medium">Pending ({pending.length})</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && pending.length === 0 && <p className="text-sm text-muted-foreground">No actions waiting for you.</p>}
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-2xl border border-warning/40 bg-card p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scope: permanently deletes 1 of your tasks · Risk: {r.risk} · Requested {new Date(r.created_at).toLocaleString()}
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(r.payload, null, 2)}</pre>
                    {r.conversation_id && (
                      <Link to="/app/agent/$conversationId" params={{ conversationId: r.conversation_id }} className="mt-2 inline-block text-xs text-primary">
                        View conversation
                      </Link>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Reject</Button>
                  <Button variant={r.action === "workflow_resume" ? "default" : "destructive"} disabled={busy === r.id} onClick={() => act(r.id, "approve")}>{r.action === "workflow_resume" ? "Approve & continue" : "Approve & delete"}</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 font-medium">Audit trail</h2>
          {done.length === 0 && <p className="text-sm text-muted-foreground">No decisions yet.</p>}
          <ul className="divide-y divide-border rounded-xl border border-border">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs ${statusClass[r.status] ?? ""}`}>{r.status}</span>
                <span className="min-w-0 flex-1 truncate">{r.summary}</span>
                <span className="text-xs text-muted-foreground">{r.decided_at ? new Date(r.decided_at).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
