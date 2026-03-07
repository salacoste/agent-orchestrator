import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { archiveSprint, getUnfinishedStories } from "./sprint-archive.js";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockRenameSync = renameSync as ReturnType<typeof vi.fn>;

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/tmp/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const SPRINT_YAML = `
development_status:
  s1:
    status: done
    epic: epic-1
  s2:
    status: in-progress
    epic: epic-1
  s3:
    status: backlog
    epic: epic-2
`;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(SPRINT_YAML);
});

describe("archiveSprint", () => {
  it("archives history file by renaming it", () => {
    archiveSprint(PROJECT);

    expect(mockRenameSync).toHaveBeenCalledOnce();
    const [src, dest] = mockRenameSync.mock.calls[0] as [string, string];
    expect(src).toContain("sprint-history.jsonl");
    expect(dest).toMatch(/sprint-history-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it("returns carried-over stories (non-done)", () => {
    const result = archiveSprint(PROJECT);

    expect(result.carriedOver).toContain("s2");
    expect(result.carriedOver).toContain("s3");
    expect(result.carriedOver).not.toContain("s1");
  });

  it("does not remove done stories by default", () => {
    archiveSprint(PROJECT);

    // writeFileSync should not be called to update sprint-status.yaml
    // (renameSync is for the history file)
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("removes done stories when archiveDone=true", () => {
    const result = archiveSprint(PROJECT, { archiveDone: true });

    expect(result.removedDone).toContain("s1");
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, content] = mockWriteFileSync.mock.calls[0] as [string, string];
    expect(content).not.toContain("s1");
    expect(content).toContain("s2");
    expect(content).toContain("s3");
  });

  it("handles missing sprint-status.yaml gracefully", () => {
    mockExistsSync.mockImplementation(
      (p: string) => typeof p === "string" && p.includes("sprint-history"),
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("sprint-status")) {
        throw new Error("not found");
      }
      return "";
    });

    const result = archiveSprint(PROJECT);

    expect(result.carriedOver).toEqual([]);
    expect(result.removedDone).toEqual([]);
  });
});

describe("getUnfinishedStories", () => {
  it("returns non-done story IDs", () => {
    const result = getUnfinishedStories(PROJECT);

    expect(result).toContain("s2");
    expect(result).toContain("s3");
    expect(result).not.toContain("s1");
  });

  it("returns empty array when sprint status is missing", () => {
    mockExistsSync.mockReturnValue(false);

    const result = getUnfinishedStories(PROJECT);

    expect(result).toEqual([]);
  });
});
