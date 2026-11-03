import { describe, expect, it } from "vitest";

import { applyTransform, validateWorkflow, type WfDefinition } from "@/lib/workflows";

const p = { x: 0, y: 0 };
const base: WfDefinition = {
  nodes: [
    { id: "t", type: "trigger", position: p, data: {} },
    { id: "i", type: "input", position: p, data: { text: "hi" } },
    { id: "o", type: "output", position: p, data: {} },
  ],
  edges: [{ id: "1", source: "t", target: "i" }, { id: "2", source: "i", target: "o" }],
};

describe("workflow validation", () => {
  it("accepts a linear workflow", () => expect(validateWorkflow(base)).toEqual([]));
  it("requires exactly one trigger", () => {
    expect(validateWorkflow({ nodes: base.nodes.slice(1), edges: [] }).join()).toMatch(/exactly one Manual trigger/);
  });
  it("rejects loops", () => {
    const def = { ...base, edges: [...base.edges, { id: "3", source: "o", target: "i" }] };
    expect(validateWorkflow(def).join()).toMatch(/Loops are not supported/);
  });
  it("flags missing configuration", () => {
    const def = { ...base, nodes: base.nodes.map((n) => (n.id === "i" ? { ...n, data: { text: "" } } : n)) };
    expect(validateWorkflow(def).join()).toMatch(/enter the text/);
  });
  it("rejects more than 25 steps", () => {
    const nodes = Array.from({ length: 26 }, (_, i) => ({ id: `n${i}`, type: "output" as const, position: p, data: {} }));
    expect(validateWorkflow({ nodes, edges: [] }).join()).toMatch(/At most 25 steps/);
  });
  it("applies templates", () => expect(applyTransform("x", "template", "a {{input}} b")).toBe("a x b"));
});
