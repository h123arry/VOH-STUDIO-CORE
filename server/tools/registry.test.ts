import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY, toolsForAgent } from "./registry";

describe("tool execution safety metadata", () => {
  it("does not expose host-process build, test, or terminal execution to agents", () => {
    for (const agent of ["qa", "devops", "frontend", "backend"]) {
      const names = toolsForAgent(agent).map(tool => tool.name);
      expect(names).not.toContain("project.build");
      expect(names).not.toContain("project.test");
      expect(names).not.toContain("computer.terminal");
    }
  });

  it("marks execution tools as high risk and unavailable", () => {
    for (const name of ["project.build", "project.test", "computer.terminal"]) {
      const tool = TOOL_REGISTRY.find(entry => entry.name === name);
      expect(tool).toMatchObject({ risk: "high", executorStatus: "registered" });
    }
  });
});
