import "@xyflow/react/dist/style.css";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowLeft, Play, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { NODE_TYPES, validateWorkflow, type NodeType, type WfData, type WfDefinition } from "@/lib/workflows";
import { runWorkflow, saveWorkflow } from "@/lib/workflows.functions";

export const Route = createFileRoute("/_authenticated/app/workflows/$workflowId")({ component: Editor });

type StepNodeData = { kind: NodeType; config: WfData };
type StepNode = Node<StepNodeData, "step">;

function StepNodeView({ data, selected }: NodeProps<StepNode>) {
  const meta = NODE_TYPES[data.kind];
  return (
    <div className={`min-w-40 rounded-lg border bg-card px-3 py-2 text-xs shadow-sm ${selected ? "border-primary" : "border-border"}`}>
      {data.kind !== "trigger" && <Handle type="target" position={Position.Top} />}
      <p className="font-medium text-foreground">{meta.label}</p>
      <p className="max-w-48 truncate text-muted-foreground">{data.config.text || data.config.prompt || data.config.contains || data.config.title || data.config.query || data.config.op || " "}</p>
      {data.kind === "condition" ? (
        <>
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: "30%" }} />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: "70%" }} />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>yes</span><span>no</span></div>
        </>
      ) : data.kind !== "output" && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
const nodeTypes = { step: StepNodeView };

const toFlow = (def: WfDefinition): { nodes: StepNode[]; edges: Edge[] } => ({
  nodes: def.nodes.map((n) => ({ id: n.id, type: "step", position: n.position, data: { kind: n.type, config: n.data ?? {} } })),
  edges: def.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, ...(e.sourceHandle ? { label: e.sourceHandle } : {}) })),
});
const toDef = (nodes: StepNode[], edges: Edge[]): WfDefinition => ({
  nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data.config })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
});

function Editor() {
  const { workflowId } = Route.useParams();
  const qc = useQueryClient();
  const save = useServerFn(saveWorkflow);
  const run = useServerFn(runWorkflow);
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const { data: wf, isLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflows").select("id, name, definition").eq("id", workflowId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["workflow-runs", workflowId],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_runs").select("id, status, steps, error, output, started_at").eq("workflow_id", workflowId).order("started_at", { ascending: false }).limit(15);
      if (error) throw error;
      return data;
    },
    refetchInterval: running ? 1500 : false,
  });

  useEffect(() => {
    if (!wf) return;
    setName(wf.name);
    const f = toFlow(wf.definition as unknown as WfDefinition);
    setNodes(f.nodes);
    setEdges(f.edges);
  }, [wf, setNodes, setEdges]);

  const problems = useMemo(() => validateWorkflow(toDef(nodes, edges)), [nodes, edges]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = (c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.sourceHandle ?? "o"}-${c.target}`, ...(c.sourceHandle ? { label: c.sourceHandle } : {}) }, es));
  const addNode = (kind: NodeType) => {
    const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
    const config: WfData = kind === "transform" ? { op: "trim" } : {};
    setNodes((ns) => [...ns, { id, type: "step", position: { x: 40 + ns.length * 20, y: 80 + ns.length * 60 }, data: { kind, config } }]);
    setSelectedId(id);
  };
  const setConfig = (key: keyof WfData, value: string) =>
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } } : n)));
  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const doSave = async () => {
    try {
      await save({ data: { id: workflowId, name: name.trim() || "Untitled workflow", definition: toDef(nodes, edges) } });
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Saved");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    }
  };
  const doRun = async () => {
    if (problems.length) { toast.error("Fix the listed problems first."); return; }
    if (!(await doSave())) return;
    setRunning(true);
    try {
      const r = await run({ data: { id: workflowId } });
      setOpenRun(r.runId);
      toast[r.status === "completed" ? "success" : "message"](`Run ${r.status.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  };
  const cancelRun = async (id: string) => {
    await supabase.from("workflow_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "running");
    qc.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
  };

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!wf) return <p className="p-6 text-sm text-muted-foreground">Workflow not found. <Link to="/app/workflows" className="text-primary">Back</Link></p>;

  const fieldsFor = (kind: NodeType) => {
    const c = selected?.data.config ?? {};
    switch (kind) {
      case "input": return <Textarea value={c.text ?? ""} onChange={(e) => setConfig("text", e.target.value)} maxLength={4000} placeholder="Text to pass on" aria-label="Input text" />;
      case "ai_text": return <Textarea value={c.prompt ?? ""} onChange={(e) => setConfig("prompt", e.target.value)} maxLength={4000} placeholder="e.g. Summarise this: {{input}}" aria-label="AI prompt" />;
      case "knowledge_search": return <Input value={c.query ?? ""} onChange={(e) => setConfig("query", e.target.value)} maxLength={200} placeholder="Leave empty to use previous output" aria-label="Search query" />;
      case "condition": return <Input value={c.contains ?? ""} onChange={(e) => setConfig("contains", e.target.value)} maxLength={200} placeholder="Word to look for" aria-label="Condition word" />;
      case "create_task": return <Input value={c.title ?? ""} onChange={(e) => setConfig("title", e.target.value)} maxLength={200} placeholder="Leave empty to use previous output" aria-label="Task title" />;
      case "transform":
        return (
          <div className="space-y-2">
            <select value={c.op ?? "trim"} onChange={(e) => setConfig("op", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" aria-label="Transform type">
              <option value="trim">Trim spaces</option><option value="upper">Uppercase</option><option value="lower">Lowercase</option><option value="template">Template</option>
            </select>
            {c.op === "template" && <Textarea value={c.template ?? ""} onChange={(e) => setConfig("template", e.target.value)} maxLength={4000} placeholder="Result: {{input}}" aria-label="Template" />}
          </div>
        );
      default: return <p className="text-xs text-muted-foreground">No settings.</p>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Back to workflows"><Link to="/app/workflows"><ArrowLeft className="size-4" /></Link></Button>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="max-w-xs" aria-label="Workflow name" />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={doSave}><Save className="size-4" /> Save</Button>
          <Button onClick={doRun} disabled={running}><Play className="size-4" /> {running ? "Running…" : "Run"}</Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex gap-1 overflow-x-auto border-b border-border p-2 lg:w-44 lg:flex-col lg:border-r lg:border-b-0">
          <p className="hidden px-1 text-xs text-muted-foreground lg:block">Add step</p>
          {(Object.keys(NODE_TYPES) as NodeType[]).filter((k) => k !== "trigger").map((k) => (
            <Button key={k} size="sm" variant="ghost" className="justify-start whitespace-nowrap" onClick={() => addNode(k)}>{NODE_TYPES[k].label}</Button>
          ))}
        </aside>
        <div className="min-h-[360px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            colorMode={dark ? "dark" : "light"}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <aside className="w-full space-y-4 overflow-y-auto border-t border-border p-4 lg:w-80 lg:border-t-0 lg:border-l">
          {selected ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{NODE_TYPES[selected.data.kind].label}</p>
              <p className="text-xs text-muted-foreground">{NODE_TYPES[selected.data.kind].help}</p>
              {fieldsFor(selected.data.kind)}
              {selected.data.kind !== "trigger" && <Button size="sm" variant="ghost" onClick={deleteSelected}><Trash2 className="size-4" /> Remove step</Button>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Select a step to configure it. Drag from a step's bottom dot to another step's top dot to connect them. Select a connection and press Backspace to remove it.</p>
          )}
          <div>
            <p className="mb-1 text-sm font-medium">Checks</p>
            {problems.length === 0 ? <p className="text-xs text-success">Ready to run.</p> : (
              <ul className="list-disc space-y-1 pl-4 text-xs text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            )}
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Runs</p>
            {runs.length === 0 && <p className="text-xs text-muted-foreground">No runs yet.</p>}
            <ul className="space-y-1">
              {runs.map((r) => (
                <li key={r.id} className="rounded-md border border-border text-xs">
                  <button className="flex w-full items-center justify-between px-2 py-1.5 text-left" onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>
                    <span>{new Date(r.started_at).toLocaleTimeString()}</span>
                    <span className={r.status === "completed" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-warning"}>{r.status.replace("_", " ")}</span>
                  </button>
                  {openRun === r.id && (
                    <div className="space-y-1 border-t border-border p-2">
                      {r.status === "running" && <Button size="sm" variant="ghost" onClick={() => cancelRun(r.id)}><Square className="size-3" /> Cancel</Button>}
                      {r.error && <p className="text-destructive">{r.error}</p>}
                      {(r.steps as { label: string; status: string; output?: string; error?: string }[]).map((s, i) => (
                        <div key={i}>
                          <p className="font-medium">{i + 1}. {s.label} — {s.status}</p>
                          {(s.output || s.error) && <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{s.error ?? s.output}</p>}
                        </div>
                      ))}
                      {r.output && <p className="whitespace-pre-wrap rounded bg-muted p-1.5"><strong>Result:</strong> {r.output}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
