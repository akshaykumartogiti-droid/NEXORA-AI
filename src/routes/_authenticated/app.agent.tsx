import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { Check, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/agent")({ component: AgentLayout });

export const conversationsQuery = {
  queryKey: ["conversations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("conversations").select("id, title, updated_at, project_id").order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data;
  },
};

export async function createConversation(projectId: string | null = null) {
  const { data, error } = await supabase.from("conversations").insert({ project_id: projectId }).select("id").single();
  if (error) throw error;
  return data.id;
}

function AgentLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const { data = [], isLoading } = useQuery(conversationsQuery);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const newChat = async () => {
    try {
      const id = await createConversation();
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/app/agent/$conversationId", params: { conversationId: id } });
    } catch {
      toast.error("Could not start a conversation");
    }
  };
  const rename = async (id: string) => {
    const title = draft.trim().slice(0, 200);
    if (!title) { setEditing(null); return; }
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) toast.error("Rename failed");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this conversation and its messages?")) return;
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); return; }
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    if (params.conversationId === id) navigate({ to: "/app/agent" });
  };

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border lg:flex">
        <div className="p-3">
          <Button onClick={newChat} className="w-full bg-gradient-brand text-primary-foreground">
            <MessageSquarePlus className="size-4" /> New conversation
          </Button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {isLoading && <li className="px-2 text-sm text-muted-foreground">Loading…</li>}
          {!isLoading && data.length === 0 && <li className="px-2 text-sm text-muted-foreground">No conversations yet.</li>}
          {data.map((c) => (
            <li key={c.id} className={`group flex items-center gap-1 rounded-lg px-1 ${params.conversationId === c.id ? "bg-accent" : "hover:bg-accent/60"}`}>
              {editing === c.id ? (
                <>
                  <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(c.id); if (e.key === "Escape") setEditing(null); }} className="h-8" aria-label="Conversation title" />
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => rename(c.id)} aria-label="Save title"><Check className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(null)} aria-label="Cancel"><X className="size-3.5" /></Button>
                </>
              ) : (
                <>
                  <Link to="/app/agent/$conversationId" params={{ conversationId: c.id }} className="min-w-0 flex-1 truncate px-2 py-2 text-sm">{c.title}</Link>
                  <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => { setEditing(c.id); setDraft(c.title); }} aria-label={`Rename ${c.title}`}><Pencil className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`}><Trash2 className="size-3.5" /></Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
