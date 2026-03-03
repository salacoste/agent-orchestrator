import { describe, expect, it } from "vitest";
import { create, manifest, default as defaultExport } from "./index.js";

describe("agent-glm plugin", () => {
  it("exposes the expected manifest", () => {
    expect(manifest).toEqual({
      name: "glm",
      slot: "agent",
      description: "Agent plugin: Z.ai GLM via yolo",
      version: "0.1.0",
    });
  });

  it("creates a Claude-compatible GLM agent", () => {
    const agent = create();
    expect(agent.name).toBe("glm");
    expect(agent.processName).toBe("yolo");
    expect(
      agent.getLaunchCommand({
        sessionId: "sess-1",
        projectConfig: {
          name: "demo",
          repo: "owner/repo",
          path: "/workspace/repo",
          defaultBranch: "main",
          sessionPrefix: "demo",
        },
      }),
    ).toBe("yolo -api");
  });

  it("exports a valid PluginModule", () => {
    expect(defaultExport.manifest).toBe(manifest);
    expect(typeof defaultExport.create).toBe("function");
  });
});
