import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { conversationsQuery, createConversation } from "./app.agent";

export const Route = createFileRoute("/_authenticated/app/agent/")({ component: AgentHome });

function AgentHome() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data = [] } = useQuery(conversationsQuery);
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id, name, instructions, updated_at").order("updated_at", { ascending: false })).data ?? [],
  });
  const [projectId, setProjectId] = useState<string>("");

  const start = async () => {
    try {
      const id = await createConversation(projectId || null);
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/app/agent/$conversationId", params: { conversationId: id } });
    } catch {
      toast.error("Could not start a conversation");
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold">What do you want to <span className="text-gradient">get done?</span></h1>
      <p className="text-sm text-muted-foreground">Start a conversation. Optionally attach a project so the agent follows its instructions.</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="proj">Project context</label>
        <select id="proj" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button onClick={start} className="bg-gradient-brand text-primary-foreground">
          <MessageSquarePlus className="size-4" /> New conversation
        </Button>
      </div>
      {data.length > 0 && (
        <div className="w-full text-left lg:hidden">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent</h2>
          <ul className="space-y-1">
            {data.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link to="/app/agent/$conversationId" params={{ conversationId: c.id }} className="block truncate rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">{c.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
