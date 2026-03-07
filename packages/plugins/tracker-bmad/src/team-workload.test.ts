import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { computeTeamWorkload } from "./team-workload.js";
import type { ProjectConfig } from "@composio/ao-core";

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/home/user/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const STATUS_PATH = "/home/user/test/_bmad-output/sprint-status.yaml";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function setFiles(opts: { statusYaml?: string }) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return true;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return opts.statusYaml;
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("computeTeamWorkload", () => {
  it("returns empty when no sprint status", () => {
    const result = computeTeamWorkload(PROJECT);
    expect(result.members).toEqual([]);
    expect(result.unassigned).toEqual([]);
    expect(result.overloaded).toEqual([]);
  });

  it("groups stories by assignedSession", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s2:",
        "    status: review",
        "    assignedSession: agent-1",
        "  s3:",
        "    status: in-progress",
        "    assignedSession: agent-2",
      ].join("\n"),
    });

    const result = computeTeamWorkload(PROJECT);

    expect(result.members.length).toBe(2);
    const agent1 = result.members.find((m) => m.sessionId === "agent-1");
    expect(agent1).toBeDefined();
    expect(agent1!.totalInFlight).toBe(2);
    expect(agent1!.storiesByColumn["in-progress"]).toContain("s1");
    expect(agent1!.storiesByColumn["review"]).toContain("s2");

    const agent2 = result.members.find((m) => m.sessionId === "agent-2");
    expect(agent2).toBeDefined();
    expect(agent2!.totalInFlight).toBe(1);
  });

  it("collects unassigned stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "    assignedSession: agent-1",
      ].join("\n"),
    });

    const result = computeTeamWorkload(PROJECT);

    expect(result.unassigned.length).toBe(1);
    expect(result.unassigned[0]!.storyId).toBe("s1");
    expect(result.unassigned[0]!.column).toBe("backlog");
  });

  it("detects overloaded members (default threshold 3)", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s2:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s3:",
        "    status: review",
        "    assignedSession: agent-1",
        "  s4:",
        "    status: in-progress",
        "    assignedSession: agent-1",
      ].join("\n"),
    });

    const result = computeTeamWorkload(PROJECT);

    expect(result.overloaded).toContain("agent-1");
    const agent1 = result.members.find((m) => m.sessionId === "agent-1");
    expect(agent1!.isOverloaded).toBe(true);
    expect(agent1!.totalInFlight).toBe(4);
  });

  it("respects custom overload threshold from config", () => {
    const projectWithLimit: ProjectConfig = {
      ...PROJECT,
      tracker: { ...PROJECT.tracker, plugin: "bmad", teamOverloadLimit: 5 },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s2:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s3:",
        "    status: review",
        "    assignedSession: agent-1",
        "  s4:",
        "    status: in-progress",
        "    assignedSession: agent-1",
      ].join("\n"),
    });

    const result = computeTeamWorkload(projectWithLimit);

    // 4 in-flight, limit is 5 — not overloaded
    expect(result.overloaded).toEqual([]);
    expect(result.overloadThreshold).toBe(5);
  });

  it("excludes done stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "    assignedSession: agent-1",
        "  s2:",
        "    status: in-progress",
        "    assignedSession: agent-1",
      ].join("\n"),
    });

    const result = computeTeamWorkload(PROJECT);

    const agent1 = result.members.find((m) => m.sessionId === "agent-1");
    expect(agent1!.totalInFlight).toBe(1); // Only s2, not s1
  });

  it("filters by epic", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "    epic: epic-auth",
        "  s2:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "    epic: epic-ui",
      ].join("\n"),
    });

    const result = computeTeamWorkload(PROJECT, "epic-auth");

    const agent1 = result.members.find((m) => m.sessionId === "agent-1");
    expect(agent1!.totalInFlight).toBe(1); // Only s1
  });
});
