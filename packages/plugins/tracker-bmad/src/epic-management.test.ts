import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

vi.mock("yaml", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    stringify: vi.fn((obj: unknown) => JSON.stringify(obj)),
  };
});

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { listEpics, createEpic, renameEpic, deleteEpic } from "./epic-management.js";

const PROJECT: ProjectConfig = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/home/user/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
    outputDir: "custom-output",
  },
};

const STATUS_PATH = "/home/user/test-project/custom-output/sprint-status.yaml";
const STORY_DIR = "/home/user/test-project/custom-output/implementation-artifacts";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;
const mockUnlinkSync = unlinkSync as ReturnType<typeof vi.fn>;

function sprintYaml(entries: Record<string, { status: string; epic?: string }>): string {
  const lines = ["development_status:"];
  for (const [id, entry] of Object.entries(entries)) {
    lines.push(`  ${id}:`);
    lines.push(`    status: ${entry.status}`);
    if (entry.epic) lines.push(`    epic: ${entry.epic}`);
  }
  return lines.join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("listEpics", () => {
  it("returns empty array when sprint status is missing", () => {
    const result = listEpics(PROJECT);
    expect(result).toEqual([]);
  });

  it("lists epics with story counts and progress", () => {
    const yaml = sprintYaml({
      s1: { status: "done", epic: "epic-auth" },
      s2: { status: "in-progress", epic: "epic-auth" },
      s3: { status: "backlog", epic: "epic-ui" },
    });
    mockExistsSync.mockImplementation((p: string) => {
      if (p === STATUS_PATH) return true;
      if (p === `${STORY_DIR}/epic-epic-auth.md`) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === STATUS_PATH) return yaml;
      if (p === `${STORY_DIR}/epic-epic-auth.md`) return "# Authentication\n";
      throw new Error(`Unexpected read: ${p}`);
    });

    const result = listEpics(PROJECT);

    expect(result).toHaveLength(2);
    const auth = result.find((e) => e.id === "epic-auth");
    expect(auth).toBeDefined();
    expect(auth!.title).toBe("Authentication");
    expect(auth!.storyCount).toBe(2);
    expect(auth!.doneCount).toBe(1);
    expect(auth!.progress).toBe(50);

    const ui = result.find((e) => e.id === "epic-ui");
    expect(ui).toBeDefined();
    expect(ui!.storyCount).toBe(1);
    expect(ui!.doneCount).toBe(0);
    expect(ui!.progress).toBe(0);
  });
});

describe("createEpic", () => {
  it("creates epic file with title and description", () => {
    mockExistsSync.mockReturnValue(false);

    const result = createEpic(PROJECT, "User Authentication", "Handle OAuth2 flows");

    expect(result.epicId).toBe("epic-user-authentication");
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("epic-epic-user-authentication.md"),
      expect.stringContaining("# User Authentication"),
      "utf-8",
    );
    // Check description is included
    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("Handle OAuth2 flows");
  });

  it("throws if title is empty", () => {
    expect(() => createEpic(PROJECT, "")).toThrow("Epic title is required");
  });

  it("throws if epic already exists", () => {
    mockExistsSync.mockReturnValue(true);
    expect(() => createEpic(PROJECT, "Auth")).toThrow("Epic already exists");
  });
});

describe("renameEpic", () => {
  it("replaces H1 title in epic file", () => {
    const epicPath = `${STORY_DIR}/epic-epic-auth.md`;
    mockExistsSync.mockImplementation((p: string) => p === epicPath);
    mockReadFileSync.mockReturnValue("# Old Title\n\nSome description\n");

    renameEpic(PROJECT, "epic-auth", "New Auth Title");

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      epicPath,
      "# New Auth Title\n\nSome description\n",
      "utf-8",
    );
  });

  it("throws if epic not found", () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => renameEpic(PROJECT, "epic-missing", "New")).toThrow("Epic not found");
  });

  it("throws if new title is empty", () => {
    expect(() => renameEpic(PROJECT, "epic-auth", "")).toThrow("New title is required");
  });
});

describe("deleteEpic", () => {
  it("deletes epic file and returns affected stories", () => {
    const epicPath = `${STORY_DIR}/epic-epic-auth.md`;
    const yaml = sprintYaml({
      s1: { status: "done", epic: "epic-auth" },
      s2: { status: "in-progress", epic: "epic-auth" },
    });
    mockExistsSync.mockImplementation((p: string) => {
      if (p === epicPath) return true;
      if (p === STATUS_PATH) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === STATUS_PATH) return yaml;
      throw new Error(`Unexpected read: ${p}`);
    });

    const result = deleteEpic(PROJECT, "epic-auth");

    expect(mockUnlinkSync).toHaveBeenCalledWith(epicPath);
    expect(result.affectedStories).toContain("s1");
    expect(result.affectedStories).toContain("s2");
  });

  it("throws if epic not found", () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => deleteEpic(PROJECT, "epic-missing")).toThrow("Epic not found");
  });
});
