import { describe, it, expect } from "vitest";
import { aggregatePortfolioProjects } from "../portfolio-aggregation";
import type { OrchestratorConfig, SessionManager, Session } from "@composio/ao-core";

describe("aggregatePortfolioProjects", () => {
  it("returns empty array when no projects configured", async () => {
    const config = { projects: {} } as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result).toEqual([]);
  });

  it("returns projects with basic metadata", async () => {
    const config = {
      projects: {
        "project-1": { name: "Project One", path: "/path/to/project" },
      },
    } as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("project-1");
    expect(result[0].name).toBe("Project One");
    expect(result[0].status).toBe("idle");
    expect(result[0].activeAgents).toBe(0);
  });

  it("counts active agents correctly", async () => {
    const config = {
      projects: {
        "project-1": { name: "Project One", path: "/path/to/project" },
      },
    } as OrchestratorConfig;

    const mockSessions: Partial<Session>[] = [
      { id: "session-1", projectId: "project-1", activity: "active", status: "working" },
      { id: "session-2", projectId: "project-1", activity: "idle", status: "idle" },
      { id: "session-3", projectId: "project-1", activity: "active", status: "working" },
    ];
    const sessionManager = {
      list: async () => mockSessions,
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].activeAgents).toBe(2);
    expect(result[0].status).toBe("active");
  });

  it("sets error status when sessions have errors", async () => {
    const config = {
      projects: {
        "project-1": { name: "Project One", path: "/path/to/project" },
      },
    } as OrchestratorConfig;

    const mockSessions: Partial<Session>[] = [
      { id: "session-1", projectId: "project-1", activity: "exited", status: "errored" },
    ];
    const sessionManager = {
      list: async () => mockSessions,
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].status).toBe("error");
  });

  it("handles multiple projects", async () => {
    const config = {
      projects: {
        "project-1": { name: "Project One", path: "/path/to/project-1" },
        "project-2": { name: "Project Two", path: "/path/to/project-2" },
      },
    } as OrchestratorConfig;

    const mockSessions: Partial<Session>[] = [
      { id: "session-1", projectId: "project-1", activity: "active", status: "working" },
      { id: "session-2", projectId: "project-2", activity: "idle", status: "idle" },
    ];
    const sessionManager = {
      list: async () => mockSessions,
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === "project-1")?.status).toBe("active");
    expect(result.find((p) => p.id === "project-2")?.status).toBe("idle");
  });

  it("uses project id as name fallback", async () => {
    const config = {
      projects: {
        "project-1": { path: "/path/to/project" },
      },
    } as unknown as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].name).toBe("project-1");
  });

  it("passes reservedAgents through to sharedPool in portfolio projects", async () => {
    const config = {
      projects: {
        "project-1": {
          name: "Project One",
          path: "/path/to/project",
          sharedPool: {
            enabled: true,
            eligibleProjects: ["project-2"],
            maxConcurrent: 3,
            reservedAgents: ["agent-x", "agent-y"],
          },
        },
        "project-2": { name: "Project Two", path: "/path/to/project-2" },
      },
    } as unknown as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].sharedPool?.reservedAgents).toEqual(["agent-x", "agent-y"]);
    expect(result[0].sharedPool?.enabled).toBe(true);
    expect(result[0].sharedPool?.maxConcurrent).toBe(3);
  });

  it("returns undefined sharedPool when no shared pool configured", async () => {
    const config = {
      projects: {
        "project-1": { name: "Project One", path: "/path/to/project" },
      },
    } as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].sharedPool).toBeUndefined();
  });

  // Story 50.4: Pool agents available aggregation
  it("computes pool agents available from other projects", async () => {
    const config = {
      projects: {
        "project-1": {
          name: "Alpha",
          path: "/alpha",
          sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
        },
        "project-2": {
          name: "Beta",
          path: "/beta",
          sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
        },
      },
    } as unknown as OrchestratorConfig;

    const mockSessions: Partial<Session>[] = [
      { id: "local-1", projectId: "project-1", activity: "active", status: "working" },
      { id: "pool-1", projectId: "project-2", activity: "idle", status: "working" },
      { id: "pool-2", projectId: "project-2", activity: "ready", status: "working" },
    ];
    const sessionManager = {
      list: async () => mockSessions,
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    const p1 = result.find((p) => p.id === "project-1")!;

    expect(p1.poolAgentsAvailable).toHaveLength(2);
    expect(p1.poolAgentsAvailable!.map((a) => a.agentId).sort()).toEqual(["pool-1", "pool-2"]);
    expect(p1.poolAgentsAvailable!.every((a) => a.sourceProjectId === "project-2")).toBe(true);
    expect(p1.poolAgentsAvailable!.every((a) => a.sourceProjectName === "Beta")).toBe(true);
  });

  it("excludes reserved agents from pool agents available", async () => {
    const config = {
      projects: {
        "project-1": {
          name: "Alpha",
          path: "/alpha",
          sharedPool: {
            enabled: true,
            eligibleProjects: ["project-2"],
            reservedAgents: ["reserved-agent"],
          },
        },
        "project-2": {
          name: "Beta",
          path: "/beta",
          sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
        },
      },
    } as unknown as OrchestratorConfig;

    const mockSessions: Partial<Session>[] = [
      { id: "reserved-agent", projectId: "project-2", activity: "idle", status: "working" },
      { id: "free-agent", projectId: "project-2", activity: "idle", status: "working" },
    ];
    const sessionManager = {
      list: async () => mockSessions,
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    const p1 = result.find((p) => p.id === "project-1")!;

    expect(p1.poolAgentsAvailable).toHaveLength(1);
    expect(p1.poolAgentsAvailable![0].agentId).toBe("free-agent");
  });

  it("returns undefined poolAgentsAvailable when no shared pool", async () => {
    const config = {
      projects: {
        "project-1": { name: "Alpha", path: "/alpha" },
      },
    } as OrchestratorConfig;
    const sessionManager = {
      list: async () => [],
    } as unknown as SessionManager;

    const result = await aggregatePortfolioProjects(config, sessionManager);
    expect(result[0].poolAgentsAvailable).toBeUndefined();
  });
});
