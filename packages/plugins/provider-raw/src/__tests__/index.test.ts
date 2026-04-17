import { describe, expect, it } from "vitest";
import { create, manifest } from "../index.js";
import type { Session, ProviderConfig, StoryContext } from "@composio/ao-core";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "test-1",
    projectId: "test-project",
    status: "working",
    activity: null,
    branch: "feat/test",
    issueId: "58-1-test",
    pr: null,
    workspacePath: "/tmp/test-workspace",
    runtimeHandle: null,
    agentInfo: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

describe("RawProvider", () => {
  const provider = create();

  it("has correct manifest", () => {
    expect(manifest.name).toBe("raw");
    expect(manifest.slot).toBe("provider");
    expect(manifest.version).toBe("0.1.0");
  });

  it("exposes name property", () => {
    expect(provider.name).toBe("raw");
  });

  it("install resolves without error", async () => {
    const config: ProviderConfig = { testKey: "testValue" };
    await expect(provider.install("/tmp/nonexistent", config)).resolves.toBeUndefined();
  });

  it("configure resolves without error", async () => {
    const context: StoryContext = {
      storyId: "58-1-test",
      storyTitle: "Test Story",
      acceptanceCriteria: ["AC1"],
    };
    await expect(provider.configure("/tmp/nonexistent", context)).resolves.toBeUndefined();
  });

  it("enhance returns session unchanged", async () => {
    const session = makeSession();
    const result = await provider.enhance(session);
    expect(result.id).toBe("test-1");
    expect(result.projectId).toBe("test-project");
    expect(result.status).toBe("working");
    expect(result.issueId).toBe("58-1-test");
  });

  it("teardown resolves without error", async () => {
    await expect(provider.teardown("/tmp/nonexistent")).resolves.toBeUndefined();
  });

  it("healthCheck returns healthy", async () => {
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.message).toBeUndefined();
    expect(health.lastCheck).toBeInstanceOf(Date);
  });

  it("handles empty config and context", async () => {
    await expect(provider.install("/tmp/x", {})).resolves.toBeUndefined();
    await expect(provider.configure("/tmp/x", { storyId: "" })).resolves.toBeUndefined();
  });
});
