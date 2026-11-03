// Browser-safe workflow definitions and validation. The server re-validates
// every definition before saving or running it.
export const NODE_TYPES = {
  trigger: { label: "Manual trigger", help: "Starts the run. Exactly one per workflow." },
  input: { label: "User input", help: "Provides fixed text to the next step." },
  ai_text: { label: "AI text", help: "Generates text. Use {{input}} for the previous step's output." },
  knowledge_search: { label: "Knowledge search", help: "Searches your documents. Empty query uses the previous output." },
  transform: { label: "Text transform", help: "Uppercase, lowercase, trim, or a template with {{input}}." },
  condition: { label: "Condition", help: "Follows the 'yes' or 'no' path depending on whether the text contains a word." },
  create_task: { label: "Create task", help: "Creates a task. Empty title uses the previous output." },
  approval_gate: { label: "Approval gate", help: "Pauses the run and asks for your approval on the Approvals page; approving continues the run." },
  output: { label: "Output", help: "Marks the final result of the run." },
} as const;
export type NodeType = keyof typeof NODE_TYPES;

export const WORKFLOW_LIMITS = { maxNodes: 25, maxEdges: 40, maxConfigChars: 4000, maxRunsPerDay: 30 } as const;

export type WfData = { text?: string; prompt?: string; contains?: string; op?: string; template?: string; query?: string; title?: string };
export type WfNode = { id: string; type: NodeType; position: { x: number; y: number }; data: WfData };
export type WfEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
export type WfDefinition = { nodes: WfNode[]; edges: WfEdge[] };

export function validateWorkflow(def: WfDefinition): string[] {
  const errors: string[] = [];
  if (def.nodes.length > WORKFLOW_LIMITS.maxNodes) errors.push(`At most ${WORKFLOW_LIMITS.maxNodes} steps.`);
  if (def.edges.length > WORKFLOW_LIMITS.maxEdges) errors.push(`At most ${WORKFLOW_LIMITS.maxEdges} connections.`);
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const triggers = def.nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) errors.push("Add exactly one Manual trigger.");
  for (const n of def.nodes) {
    if (!(n.type in NODE_TYPES)) { errors.push(`Unknown step type "${n.type}".`); continue; }
    const name: string = NODE_TYPES[n.type].label;
    for (const v of Object.values(n.data ?? {})) if (typeof v !== "string" || v.length > WORKFLOW_LIMITS.maxConfigChars) errors.push(`${name}: a setting is too long.`);
    if (n.type === "input" && !n.data?.text?.trim()) errors.push(`${name}: enter the text.`);
    if (n.type === "ai_text" && !n.data?.prompt?.trim()) errors.push(`${name}: enter a prompt.`);
    if (n.type === "condition" && !n.data?.contains?.trim()) errors.push(`${name}: enter the word to look for.`);
    if (n.type === "transform" && n.data?.op === "template" && !n.data?.template?.trim()) errors.push(`${name}: enter a template.`);
  }
  const incoming = new Map<string, number>();
  for (const e of def.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) { errors.push("A connection points to a missing step."); continue; }
    if (byId.get(e.target)?.type === "trigger") errors.push("Nothing can connect into the Manual trigger.");
    if (byId.get(e.source)?.type === "condition" && e.sourceHandle !== "yes" && e.sourceHandle !== "no") errors.push("Condition connections must use the yes or no handle.");
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }
  for (const [id, c] of incoming) if (c > 1) errors.push(`${NODE_TYPES[byId.get(id)!.type]?.label ?? "A step"} has more than one incoming connection.`);
  if (hasCycle(def)) errors.push("Loops are not supported. Remove the circular connection.");
  if (triggers.length === 1) {
    const reach = reachable(def, triggers[0]!.id);
    const orphan = def.nodes.filter((n) => !reach.has(n.id));
    if (orphan.length) errors.push(`${orphan.length} step(s) are not connected to the trigger.`);
  }
  return [...new Set(errors)];
}

function hasCycle(def: WfDefinition) {
  const out = new Map<string, string[]>();
  for (const e of def.edges) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const t of out.get(id) ?? []) if (visit(t)) return true;
    state.set(id, 2);
    return false;
  };
  return def.nodes.some((n) => visit(n.id));
}

function reachable(def: WfDefinition, start: string) {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of def.edges) if (e.source === id && !seen.has(e.target)) { seen.add(e.target); stack.push(e.target); }
  }
  return seen;
}

export function applyTransform(input: string, op: string | undefined, template?: string) {
  switch (op) {
    case "upper": return input.toUpperCase();
    case "lower": return input.toLowerCase();
    case "template": return (template ?? "").replaceAll("{{input}}", input);
    default: return input.trim();
  }
}
