import { describe, expect, it } from "vitest";

import { TOOL_RISK } from "@/lib/agent-tools.server";

describe("agent tool policy", () => {
  it("task deletion is high risk and needs approval", () => {
    expect(TOOL_RISK.request_task_deletion).toBe("high");
  });
  it("creating tasks runs automatically", () => {
    expect(TOOL_RISK.create_task).toBe("low");
  });
});
