import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app/page";
import { supabase } from "@/integrations/supabase/client";
import { dailyLimitFor, usageDayStart } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/app/usage")({ component: Usage });

function Usage() {
  const { data, isLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("usage_records").select("id, model, input_tokens, output_tokens, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const { data: ent } = useQuery({
    queryKey: ["entitlement"],
    queryFn: async () => (await supabase.from("entitlements").select("plan, expires_at, requests_per_day").maybeSingle()).data,
  });
  const { data: dailyCount } = useQuery({ queryKey: ["usage", "today", usageDayStart().toISOString()], queryFn: async () => { const { count, error } = await supabase.from("usage_records").select("id", { count: "exact", head: true }).gte("created_at", usageDayStart().toISOString()); if (error) throw error; return count ?? 0; } });
  const rows = data ?? [];
  const dayAgo = usageDayStart().getTime();
  const today = rows.filter((r) => new Date(r.created_at).getTime() >= dayAgo).length;
  const tokensIn = rows.reduce((s, r) => s + r.input_tokens, 0);
  const tokensOut = rows.reduce((s, r) => s + r.output_tokens, 0);
  return (
    <div>
      <PageHeader title="Usage" description="Measured from real AI responses. Cost estimates are not shown because exact per-token pricing isn't available to the app." />
      <div className="grid gap-4 p-6 sm:grid-cols-3">
        <Stat label="Requests today (India time)" value={`${dailyCount ?? today} / ${dailyLimitFor(ent)}`} />
        <Stat label="Input tokens (30 days)" value={tokensIn.toLocaleString()} />
        <Stat label="Output tokens (30 days)" value={tokensOut.toLocaleString()} />
      </div>
      <div className="px-6 pb-6">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="px-4 py-2">Time</th><th className="px-4 py-2">Model</th><th className="px-4 py-2">In</th><th className="px-4 py-2">Out</th><th className="px-4 py-2">Status</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="px-4 py-3" colSpan={5}>Loading…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td className="px-4 py-3 text-muted-foreground" colSpan={5}>No AI requests yet.</td></tr>}
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.model}</td>
                  <td className="px-4 py-2">{r.input_tokens}</td>
                  <td className="px-4 py-2">{r.output_tokens}</td>
                  <td className={`px-4 py-2 ${r.status === "ok" ? "text-success" : "text-destructive"}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
