import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/projects")({ component: Projects });

type Project = { id: string; name: string; instructions: string; updated_at: string };

function Projects() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, instructions, updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 120);
    if (!n) return;
    const { error } = await supabase.from("projects").insert({ name: n });
    if (error) { toast.error("Could not create project"); return; }
    setName("");
    refresh();
  };
  return (
    <div>
      <PageHeader title="Projects" description="Explicit, editable context. Instructions here are sent to the agent in that project's conversations." />
      <div className="space-y-4 p-6">
        <form onSubmit={add} className="flex max-w-xl gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New project name" maxLength={120} aria-label="New project name" />
          <Button type="submit"><Plus className="size-4" /> Create</Button>
        </form>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && data.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((p) => <ProjectCard key={p.id} project={p} onChange={refresh} />)}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onChange }: { project: Project; onChange: () => void }) {
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const dirty = name !== project.name || instructions !== project.instructions;
  const save = async () => {
    const { error } = await supabase.from("projects").update({ name: name.trim().slice(0, 120) || project.name, instructions: instructions.slice(0, 8000), updated_at: new Date().toISOString() }).eq("id", project.id);
    if (error) { toast.error("Save failed"); return; }
    toast.success("Project saved");
    onChange();
  };
  const remove = async () => {
    if (!confirm(`Delete project "${project.name}"? Its conversations and tasks are kept but unlinked.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) { toast.error("Delete failed"); return; }
    onChange();
  };
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Project name" className="font-medium" />
      <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={8000} rows={5} placeholder="Instructions the agent should follow for this project…" aria-label="Project instructions" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{instructions.length}/8000</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="size-4" /> Delete</Button>
          <Button size="sm" disabled={!dirty} onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}
