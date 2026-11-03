import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NODE_TYPES, WORKFLOW_LIMITS, validateWorkflow, type WfDefinition } from "@/lib/workflows";

const nodeSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(Object.keys(NODE_TYPES) as [keyof typeof NODE_TYPES, ...(keyof typeof NODE_TYPES)[]]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.string().max(WORKFLOW_LIMITS.maxConfigChars)),
});
const defSchema = z.object({
  nodes: z.array(nodeSchema).max(WORKFLOW_LIMITS.maxNodes),
  edges: z.array(z.object({ id: z.string().max(128), source: z.string().max(64), target: z.string().max(64), sourceHandle: z.string().max(16).nullable().optional() })).max(WORKFLOW_LIMITS.maxEdges),
});

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), definition: defSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workflows")
      .update({ name: data.name, definition: data.definition as never, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not save the workflow.");
    return { ok: true, problems: validateWorkflow(data.definition as WfDefinition) };
  });

export { defSchema };

export const runWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wf } = await supabase.from("workflows").select("id, definition").eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (!wf) throw new Error("Workflow not found.");
    const parsed = defSchema.safeParse(wf.definition);
    if (!parsed.success) throw new Error("The saved workflow is invalid.");
    const def = parsed.data as WfDefinition;
    const problems = validateWorkflow(def);
    if (problems.length) throw new Error(`Fix these first: ${problems.join(" ")}`);

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count: running } = await supabase.from("workflow_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "running").gte("started_at", new Date(Date.now() - 300_000).toISOString());
    if ((running ?? 0) > 0) throw new Error("Another workflow is still running. Wait for it to finish.");
    const { count: today } = await supabase.from("workflow_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("started_at", since);
    if ((today ?? 0) >= WORKFLOW_LIMITS.maxRunsPerDay) throw new Error(`Daily limit reached (${WORKFLOW_LIMITS.maxRunsPerDay} runs).`);

    const { data: run, error: runErr } = await supabase.from("workflow_runs").insert({ workflow_id: wf.id, user_id: userId }).select("id").single();
    if (runErr || !run) throw new Error("Could not start the run.");

    const { executeWorkflow } = await import("@/lib/workflow-engine.server");
    const trigger = def.nodes.find((n) => n.type === "trigger")!;
    return executeWorkflow(supabase, userId, def, run.id, [{ node: trigger, input: "" }], []);
  });
