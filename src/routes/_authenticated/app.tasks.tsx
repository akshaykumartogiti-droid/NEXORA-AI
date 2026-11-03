import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tasks")({ component: Tasks });

const statuses = ["todo", "in_progress", "done"] as const;
type Status = (typeof statuses)[number];
const label: Record<Status, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

function Tasks() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim().slice(0, 200);
    if (!t) return;
    const { error } = await supabase.from("tasks").insert({ title: t });
    if (error) { toast.error("Could not add task"); return; }
    setTitle("");
    refresh();
  };
  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Update failed");
    refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    refresh();
  };
  const shown = filter === "all" ? data : data.filter((t) => t.status === filter);

  return (
    <div>
      <PageHeader title="Tasks" description="Personal tasks. Agent-created tasks arrive in a later stage." />
      <div className="space-y-4 p-6">
        <form onSubmit={add} className="flex max-w-xl gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" maxLength={200} aria-label="New task title" />
          <Button type="submit"><Plus className="size-4" /> Add</Button>
        </form>
        <div className="flex gap-1" role="tablist" aria-label="Filter tasks">
          {(["all", ...statuses] as const).map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "secondary" : "ghost"} onClick={() => setFilter(s)} role="tab" aria-selected={filter === s}>
              {s === "all" ? "All" : label[s]}
            </Button>
          ))}
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && shown.length === 0 && <p className="text-sm text-muted-foreground">No tasks here.</p>}
        <ul className="max-w-3xl divide-y divide-border rounded-xl border border-border">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
              <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value as Status)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label={`Status of ${t.title}`}>
                {statuses.map((s) => <option key={s} value={s}>{label[s]}</option>)}
              </select>
              <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label={`Delete ${t.title}`}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
