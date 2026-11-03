import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]) });

// Executes or rejects a pending approval. Runs as the signed-in user, so
// access rules guarantee only the owner's requests and tasks are touched.
export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req } = await supabase
      .from("approval_requests")
      .select("id, action, payload, status, run_id")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!req) throw new Error("Approval request not found.");
    if (req.status !== "pending") throw new Error("This request was already decided.");

    const now = new Date().toISOString();
    const log = async (output: Record<string, unknown>) => {
      if (req.run_id)
        await supabase.from("agent_run_events").insert({ run_id: req.run_id, user_id: userId, kind: "approval", tool: req.action, input: { decision: data.decision }, output } as never);
    };

    if (data.decision === "reject") {
      if (req.action === "workflow_resume") {
        const runId = (req.payload as { workflow_run_id?: string }).workflow_run_id;
        if (runId) await supabase.from("workflow_runs").update({ status: "cancelled", error: "Approval rejected.", finished_at: now }).eq("id", runId).eq("user_id", userId).eq("status", "awaiting_approval");
      }
      await supabase.from("approval_requests").update({ status: "rejected", decided_at: now, result: "Rejected by user." }).eq("id", req.id).eq("status", "pending");
      await log({ status: "rejected" });
      return { status: "rejected" as const };
    }

    if (req.action === "delete_task") {
      const taskId = (req.payload as { task_id?: string }).task_id;
      const { data: deleted, error } = taskId
        ? await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId).select("id")
        : { data: [], error: null };
      const ok = !error && (deleted?.length ?? 0) > 0;
      const result = ok ? "Task deleted." : "Task no longer exists or could not be deleted.";
      await supabase.from("approval_requests").update({ status: ok ? "executed" : "failed", decided_at: now, result }).eq("id", req.id).eq("status", "pending");
      await log({ status: ok ? "executed" : "failed", result });
      return { status: ok ? ("executed" as const) : ("failed" as const), result };
    }
    if (req.action === "workflow_resume") {
      const p = req.payload as { workflow_run_id?: string; node_id?: string; input?: string };
      const { data: run } = await supabase
        .from("workflow_runs")
        .update({ status: "running", finished_at: null })
        .eq("id", p.workflow_run_id ?? "")
        .eq("user_id", userId)
        .eq("status", "awaiting_approval")
        .select("id, steps, workflows(definition)")
        .maybeSingle();
      const def = (run?.workflows as { definition: unknown } | null)?.definition;
      const { defSchema } = await import("@/lib/workflows.functions");
      const parsed = defSchema.safeParse(def);
      const gate = parsed.success ? parsed.data.nodes.find((n) => n.id === p.node_id) : undefined;
      if (!run || !parsed.success || !gate) {
        await supabase.from("approval_requests").update({ status: "failed", decided_at: now, result: "The workflow run is no longer waiting." }).eq("id", req.id).eq("status", "pending");
        return { status: "failed" as const, result: "The workflow run is no longer waiting." };
      }
      await supabase.from("approval_requests").update({ status: "executed", decided_at: now, result: "Workflow resumed." }).eq("id", req.id).eq("status", "pending");
      const { executeWorkflow } = await import("@/lib/workflow-engine.server");
      const steps = ((run.steps as never[]) ?? []).filter((s: { node_id?: string; status?: string }) => !(s.node_id === gate.id && s.status === "stopped"));
      const res = await executeWorkflow(supabase, userId, parsed.data as never, run.id, [{ node: gate as never, input: p.input ?? "" }], steps, gate.id);
      return { status: "executed" as const, result: `Workflow ${res.status.replace("_", " ")}.` };
    }
    throw new Error("Unsupported action.");
  });
