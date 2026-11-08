import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Called only after the caller's identity and resource ownership are verified.
export async function reserveUsage(userId: string, kind: "chat" | "workflow", model: string) {
  const { data, error } = await supabaseAdmin.rpc("reserve_ai_request", { _user_id: userId, _kind: kind, _model: model });
  if (error) throw new Error("Could not check your AI allowance. Please try again.");
  const result = data as { ok?: boolean; id?: string; reason?: string } | null;
  if (!result?.ok || !result.id) throw new Error(result?.reason ?? "AI allowance unavailable.");
  return result.id;
}

export async function finishUsage(id: string, status: string, usage?: { inputTokens?: number; outputTokens?: number }) {
  const { error } = await supabaseAdmin.from("usage_records").update({ status, input_tokens: usage?.inputTokens ?? 0, output_tokens: usage?.outputTokens ?? 0 }).eq("id", id);
  if (error) console.error("Could not update AI usage outcome");
}