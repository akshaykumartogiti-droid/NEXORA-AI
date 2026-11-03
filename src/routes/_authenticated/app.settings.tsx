import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { ThemeToggle } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AI_MODEL_LABEL } from "@/lib/model";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("display_name").maybeSingle()).data,
  });
  const [name, setName] = useState("");
  useEffect(() => setName(data?.display_name ?? ""), [data]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80), updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) { toast.error("Save failed"); return; }
    toast.success("Profile saved");
    qc.invalidateQueries();
  };
  const deleteConversations = async () => {
    if (!confirm("Permanently delete ALL your conversations and messages?")) return;
    const { error } = await supabase.from("conversations").delete().eq("user_id", user.id);
    if (error) { toast.error("Delete failed"); return; }
    toast.success("All conversations deleted");
    qc.invalidateQueries();
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="max-w-2xl space-y-6 p-6">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">Profile</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <Label htmlFor="dn">Display name</Label>
          <div className="flex gap-2">
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Button onClick={save}>Save</Button>
          </div>
        </section>
        <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Theme</h2>
            <p className="text-sm text-muted-foreground">Switch between dark and light.</p>
          </div>
          <ThemeToggle />
        </section>
        <section className="space-y-1 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">AI provider</h2>
          <p className="text-sm text-muted-foreground">Model: <span className="font-mono">{AI_MODEL_LABEL}</span> via Lovable AI. Configured on the server; not changeable per user yet.</p>
        </section>
        <section className="space-y-3 rounded-2xl border border-destructive/40 p-5">
          <h2 className="font-medium">Privacy</h2>
          <p className="text-sm text-muted-foreground">Your data is private to your account. You can erase your conversation history here.</p>
          <Button variant="destructive" onClick={deleteConversations}>Delete all conversations</Button>
        </section>
      </div>
    </div>
  );
}
