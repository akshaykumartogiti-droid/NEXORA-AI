import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/workflows/")({ component: Workflows });

const starter = {
  nodes: [
    { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} },
    { id: "output", type: "output", position: { x: 0, y: 160 }, data: {} },
  ],
  edges: [{ id: "e-trigger-output", source: "trigger", target: "output" }],
};

function Workflows() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflows").select("id, name, updated_at").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 120) || "Untitled workflow";
    const { data: wf, error } = await supabase.from("workflows").insert({ name: n, definition: starter } as never).select("id").single();
    if (error || !wf) { toast.error("Could not create workflow"); return; }
    setName("");
    qc.invalidateQueries({ queryKey: ["workflows"] });
    navigate({ to: "/app/workflows/$workflowId", params: { workflowId: wf.id } });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("workflows").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    qc.invalidateQueries({ queryKey: ["workflows"] });
  };

  return (
    <div>
      <PageHeader title="Workflows" description="Build step-by-step automations and run them on demand." />
      <div className="max-w-3xl space-y-4 p-6">
        <form onSubmit={create} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New workflow name…" maxLength={120} aria-label="New workflow name" />
          <Button type="submit"><Plus className="size-4" /> Create</Button>
        </form>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && data.length === 0 && <p className="text-sm text-muted-foreground">No workflows yet.</p>}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {data.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-3">
              <GitBranch className="size-4 text-muted-foreground" />
              <Link to="/app/workflows/$workflowId" params={{ workflowId: w.id }} className="flex-1 truncate text-sm hover:text-primary">{w.name}</Link>
              <span className="text-xs text-muted-foreground">{new Date(w.updated_at).toLocaleDateString()}</span>
              <Button size="icon" variant="ghost" onClick={() => remove(w.id)} aria-label={`Delete ${w.name}`}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
