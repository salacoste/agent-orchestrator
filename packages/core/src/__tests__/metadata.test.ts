import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  readMetadata,
  readMetadataRaw,
  readArchivedMetadataRaw,
  writeMetadata,
  updateMetadata,
  deleteMetadata,
  listMetadata,
} from "../metadata.js";

let dataDir: string;

beforeEach(() => {
  dataDir = join(tmpdir(), `ao-test-metadata-${randomUUID()}`);
  mkdirSync(dataDir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("writeMetadata + readMetadata", () => {
  it("writes and reads basic metadata", () => {
    writeMetadata(dataDir, "app-1", {
      worktree: "/tmp/worktree",
      branch: "feat/test",
      status: "working",
    });

    const meta = readMetadata(dataDir, "app-1");
    expect(meta).not.toBeNull();
    expect(meta!.worktree).toBe("/tmp/worktree");
    expect(meta!.branch).toBe("feat/test");
    expect(meta!.status).toBe("working");
  });

  it("writes and reads optional fields", () => {
    writeMetadata(dataDir, "app-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "pr_open",
      issue: "https://linear.app/team/issue/INT-100",
      pr: "https://github.com/org/repo/pull/42",
      summary: "Implementing feature X",
      project: "my-app",
      createdAt: "2025-01-01T00:00:00.000Z",
      runtimeHandle: '{"id":"tmux-1","runtimeName":"tmux"}',
    });

    const meta = readMetadata(dataDir, "app-2");
    expect(meta).not.toBeNull();
    expect(meta!.issue).toBe("https://linear.app/team/issue/INT-100");
    expect(meta!.pr).toBe("https://github.com/org/repo/pull/42");
    expect(meta!.summary).toBe("Implementing feature X");
    expect(meta!.project).toBe("my-app");
    expect(meta!.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(meta!.runtimeHandle).toBe('{"id":"tmux-1","runtimeName":"tmux"}');
  });

  it("returns null for nonexistent session", () => {
    const meta = readMetadata(dataDir, "nonexistent");
    expect(meta).toBeNull();
  });

  it("produces key=value format matching bash scripts", () => {
    writeMetadata(dataDir, "app-3", {
      worktree: "/tmp/w",
      branch: "feat/INT-123",
      status: "working",
      issue: "https://linear.app/team/issue/INT-123",
    });

    const content = readFileSync(join(dataDir, "app-3"), "utf-8");
    expect(content).toContain("worktree=/tmp/w\n");
    expect(content).toContain("branch=feat/INT-123\n");
    expect(content).toContain("status=working\n");
    expect(content).toContain("issue=https://linear.app/team/issue/INT-123\n");
  });

  it("omits optional fields that are undefined", () => {
    writeMetadata(dataDir, "app-4", {
      worktree: "/tmp/w",
      branch: "main",
      status: "spawning",
    });

    const content = readFileSync(join(dataDir, "app-4"), "utf-8");
    expect(content).not.toContain("issue=");
    expect(content).not.toContain("pr=");
    expect(content).not.toContain("summary=");
  });
});

describe("readMetadataRaw", () => {
  it("reads arbitrary key=value pairs", () => {
    writeFileSync(
      join(dataDir, "raw-1"),
      "worktree=/tmp/w\nbranch=main\ncustom_key=custom_value\n",
      "utf-8",
    );

    const raw = readMetadataRaw(dataDir, "raw-1");
    expect(raw).not.toBeNull();
    expect(raw!["worktree"]).toBe("/tmp/w");
    expect(raw!["custom_key"]).toBe("custom_value");
  });

  it("returns null for nonexistent session", () => {
    expect(readMetadataRaw(dataDir, "nope")).toBeNull();
  });

  it("handles comments and empty lines", () => {
    writeFileSync(
      join(dataDir, "raw-2"),
      "# This is a comment\n\nkey1=value1\n\n# Another comment\nkey2=value2\n",
      "utf-8",
    );

    const raw = readMetadataRaw(dataDir, "raw-2");
    expect(raw).toEqual({ key1: "value1", key2: "value2" });
  });

  it("handles values containing equals signs", () => {
    writeFileSync(
      join(dataDir, "raw-3"),
      'runtimeHandle={"id":"foo","data":{"key":"val"}}\n',
      "utf-8",
    );

    const raw = readMetadataRaw(dataDir, "raw-3");
    expect(raw!["runtimeHandle"]).toBe('{"id":"foo","data":{"key":"val"}}');
  });
});

describe("updateMetadata", () => {
  it("updates specific fields while preserving others", () => {
    writeMetadata(dataDir, "upd-1", {
      worktree: "/tmp/w",
      branch: "main",
      status: "spawning",
    });

    updateMetadata(dataDir, "upd-1", {
      status: "working",
      pr: "https://github.com/org/repo/pull/1",
    });

    const meta = readMetadata(dataDir, "upd-1");
    expect(meta!.status).toBe("working");
    expect(meta!.pr).toBe("https://github.com/org/repo/pull/1");
    expect(meta!.worktree).toBe("/tmp/w");
    expect(meta!.branch).toBe("main");
  });

  it("deletes keys set to empty string", () => {
    writeMetadata(dataDir, "upd-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
      summary: "doing stuff",
    });

    updateMetadata(dataDir, "upd-2", { summary: "" });

    const raw = readMetadataRaw(dataDir, "upd-2");
    expect(raw!["summary"]).toBeUndefined();
    expect(raw!["status"]).toBe("working");
  });

  it("creates file if it does not exist", () => {
    updateMetadata(dataDir, "upd-3", { status: "new", branch: "test" });

    const raw = readMetadataRaw(dataDir, "upd-3");
    expect(raw).toEqual({ status: "new", branch: "test" });
  });

  it("ignores undefined values", () => {
    writeMetadata(dataDir, "upd-4", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    updateMetadata(dataDir, "upd-4", { status: "pr_open", summary: undefined });

    const meta = readMetadata(dataDir, "upd-4");
    expect(meta!.status).toBe("pr_open");
    expect(meta!.summary).toBeUndefined();
  });
});

describe("deleteMetadata", () => {
  it("deletes metadata file and archives it", () => {
    writeMetadata(dataDir, "del-1", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    deleteMetadata(dataDir, "del-1", true);

    expect(existsSync(join(dataDir, "del-1"))).toBe(false);
    const archiveDir = join(dataDir, "archive");
    expect(existsSync(archiveDir)).toBe(true);
    const files = readdirSync(archiveDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^del-1_/);
  });

  it("deletes without archiving when archive=false", () => {
    writeMetadata(dataDir, "del-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    deleteMetadata(dataDir, "del-2", false);

    expect(existsSync(join(dataDir, "del-2"))).toBe(false);
    expect(existsSync(join(dataDir, "archive"))).toBe(false);
  });

  it("is a no-op for nonexistent session", () => {
    expect(() => deleteMetadata(dataDir, "nope")).not.toThrow();
  });
});

describe("readArchivedMetadataRaw", () => {
  it("reads the latest archived metadata for a session", () => {
    const archiveDir = join(dataDir, "archive");
    mkdirSync(archiveDir, { recursive: true });

    writeFileSync(
      join(archiveDir, "app-1_2025-01-01T00-00-00-000Z"),
      "branch=old-branch\nstatus=killed\n",
    );
    writeFileSync(
      join(archiveDir, "app-1_2025-06-15T12-00-00-000Z"),
      "branch=new-branch\nstatus=killed\n",
    );

    const raw = readArchivedMetadataRaw(dataDir, "app-1");
    expect(raw).not.toBeNull();
    expect(raw!["branch"]).toBe("new-branch");
  });

  it("does not match archives of session IDs sharing a prefix", () => {
    const archiveDir = join(dataDir, "archive");
    mkdirSync(archiveDir, { recursive: true });

    // "app" should NOT match "app_v2_..." (belongs to session "app_v2")
    writeFileSync(
      join(archiveDir, "app_v2_2025-01-01T00-00-00-000Z"),
      "branch=wrong\nstatus=killed\n",
    );

    expect(readArchivedMetadataRaw(dataDir, "app")).toBeNull();
  });

  it("correctly matches when similar-prefix sessions coexist in archive", () => {
    const archiveDir = join(dataDir, "archive");
    mkdirSync(archiveDir, { recursive: true });

    // Archive for "app" — timestamp starts with digit
    writeFileSync(
      join(archiveDir, "app_2025-06-15T12-00-00-000Z"),
      "branch=correct\nstatus=killed\n",
    );
    // Archive for "app_v2" — should not be matched by "app"
    writeFileSync(
      join(archiveDir, "app_v2_2025-01-01T00-00-00-000Z"),
      "branch=wrong\nstatus=killed\n",
    );

    const raw = readArchivedMetadataRaw(dataDir, "app");
    expect(raw).not.toBeNull();
    expect(raw!["branch"]).toBe("correct");

    const rawV2 = readArchivedMetadataRaw(dataDir, "app_v2");
    expect(rawV2).not.toBeNull();
    expect(rawV2!["branch"]).toBe("wrong");
  });

  it("returns null when no archive exists for session", () => {
    const archiveDir = join(dataDir, "archive");
    mkdirSync(archiveDir, { recursive: true });

    writeFileSync(
      join(archiveDir, "other-session_2025-01-01T00-00-00-000Z"),
      "branch=main\nstatus=killed\n",
    );

    expect(readArchivedMetadataRaw(dataDir, "app-1")).toBeNull();
  });

  it("returns null when archive directory does not exist", () => {
    expect(readArchivedMetadataRaw(dataDir, "app-1")).toBeNull();
  });

  it("integrates with deleteMetadata archive", () => {
    writeMetadata(dataDir, "app-1", {
      worktree: "/tmp/w",
      branch: "feat/test",
      status: "killed",
      issue: "TEST-1",
    });

    deleteMetadata(dataDir, "app-1", true);

    // Active metadata should be gone
    expect(readMetadataRaw(dataDir, "app-1")).toBeNull();

    // Archived metadata should be readable
    const archived = readArchivedMetadataRaw(dataDir, "app-1");
    expect(archived).not.toBeNull();
    expect(archived!["branch"]).toBe("feat/test");
    expect(archived!["issue"]).toBe("TEST-1");
  });
});

describe("atomic writes", () => {
  it("writeMetadata leaves no .tmp files behind", () => {
    writeMetadata(dataDir, "atomic-1", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    const files = readdirSync(dataDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);
    // Verify the actual file was written correctly
    const meta = readMetadata(dataDir, "atomic-1");
    expect(meta!.status).toBe("working");
  });

  it("updateMetadata leaves no .tmp files behind", () => {
    writeMetadata(dataDir, "atomic-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "spawning",
    });

    updateMetadata(dataDir, "atomic-2", { status: "working" });

    const files = readdirSync(dataDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);
    const meta = readMetadata(dataDir, "atomic-2");
    expect(meta!.status).toBe("working");
  });

  it("concurrent writeMetadata calls do not produce corrupt files", () => {
    // Simulate rapid sequential writes (synchronous, so they serialize naturally,
    // but each individual write must be atomic — no partial content)
    for (let i = 0; i < 20; i++) {
      writeMetadata(dataDir, "atomic-3", {
        worktree: "/tmp/w",
        branch: `branch-${i}`,
        status: "working",
        summary: `iteration ${i}`,
      });
    }

    const meta = readMetadata(dataDir, "atomic-3");
    expect(meta).not.toBeNull();
    expect(meta!.branch).toBe("branch-19");
    expect(meta!.summary).toBe("iteration 19");

    // No leftover temp files
    const files = readdirSync(dataDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);
  });
});

describe("restoredAt persistence", () => {
  it("roundtrips restoredAt through writeMetadata and readMetadata", () => {
    const now = new Date().toISOString();
    writeMetadata(dataDir, "restore-1", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
      restoredAt: now,
    });

    const meta = readMetadata(dataDir, "restore-1");
    expect(meta).not.toBeNull();
    expect(meta!.restoredAt).toBe(now);
  });

  it("restoredAt is persisted in the key=value file", () => {
    const now = "2026-03-01T12:00:00.000Z";
    writeMetadata(dataDir, "restore-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
      restoredAt: now,
    });

    const content = readFileSync(join(dataDir, "restore-2"), "utf-8");
    expect(content).toContain(`restoredAt=${now}`);
  });

  it("restoredAt is undefined when not set", () => {
    writeMetadata(dataDir, "restore-3", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    const meta = readMetadata(dataDir, "restore-3");
    expect(meta!.restoredAt).toBeUndefined();
  });

  it("updateMetadata can set restoredAt on an existing session", () => {
    writeMetadata(dataDir, "restore-4", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    const now = new Date().toISOString();
    updateMetadata(dataDir, "restore-4", { restoredAt: now });

    const meta = readMetadata(dataDir, "restore-4");
    expect(meta!.restoredAt).toBe(now);
  });
});

describe("metadata backup and corruption recovery", () => {
  it("creates backup file on writeMetadata", () => {
    // First write — no backup yet (no existing file)
    writeMetadata(dataDir, "backup-1", {
      worktree: "/tmp/w",
      branch: "v1",
      status: "working",
    });
    expect(existsSync(join(dataDir, "backup-1.backup"))).toBe(false);

    // Second write — should backup the v1 file
    writeMetadata(dataDir, "backup-1", {
      worktree: "/tmp/w",
      branch: "v2",
      status: "working",
    });
    expect(existsSync(join(dataDir, "backup-1.backup"))).toBe(true);

    const backupContent = readFileSync(join(dataDir, "backup-1.backup"), "utf-8");
    expect(backupContent).toContain("branch=v1");
  });

  it("creates backup file on updateMetadata", () => {
    writeMetadata(dataDir, "backup-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    updateMetadata(dataDir, "backup-2", { status: "blocked" });

    expect(existsSync(join(dataDir, "backup-2.backup"))).toBe(true);
    const backupContent = readFileSync(join(dataDir, "backup-2.backup"), "utf-8");
    expect(backupContent).toContain("status=working");
  });

  it("recovers from backup when primary is corrupted", () => {
    writeMetadata(dataDir, "corrupt-1", {
      worktree: "/tmp/w",
      branch: "good-branch",
      status: "working",
    });

    // Write again to create a backup
    writeMetadata(dataDir, "corrupt-1", {
      worktree: "/tmp/w",
      branch: "good-branch-v2",
      status: "working",
    });

    // Corrupt the primary file (write garbage that has no key=value pairs)
    writeFileSync(join(dataDir, "corrupt-1"), "!@#$%^&*()_corrupted_data\x00\x01\x02");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const meta = readMetadata(dataDir, "corrupt-1");

    expect(meta).not.toBeNull();
    expect(meta!.branch).toBe("good-branch"); // Recovered from backup (v1)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("corrupted"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("restored from backup"));
  });

  it("returns null when both primary and backup are corrupted", () => {
    writeMetadata(dataDir, "corrupt-2", {
      worktree: "/tmp/w",
      branch: "main",
      status: "working",
    });

    // Create a backup by writing again
    writeMetadata(dataDir, "corrupt-2", {
      worktree: "/tmp/w",
      branch: "main-v2",
      status: "working",
    });

    // Corrupt both files
    writeFileSync(join(dataDir, "corrupt-2"), "garbage_no_equals_here");
    writeFileSync(join(dataDir, "corrupt-2.backup"), "more_garbage_no_equals");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const meta = readMetadata(dataDir, "corrupt-2");

    expect(meta).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("corrupted"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("backup also corrupt"));
  });

  it("returns null when primary is corrupted and no backup exists", () => {
    // Write a corrupted file directly (no prior writeMetadata so no backup)
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "corrupt-3"), "no_valid_key_value_pairs_here!");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const meta = readMetadata(dataDir, "corrupt-3");

    expect(meta).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("corrupted"));
  });

  it("calls onCorruptionDetected callback with recovered=true when backup succeeds", () => {
    writeMetadata(dataDir, "cb-1", { worktree: "/tmp/w", branch: "v1", status: "working" });
    writeMetadata(dataDir, "cb-1", { worktree: "/tmp/w", branch: "v2", status: "working" });

    // Corrupt primary
    writeFileSync(join(dataDir, "cb-1"), "corrupted_garbage_data!");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const callback = vi.fn();
    const meta = readMetadata(dataDir, "cb-1", callback);

    expect(meta).not.toBeNull();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.stringContaining("cb-1"), true);
  });

  it("calls onCorruptionDetected callback with recovered=false when backup also fails", () => {
    writeMetadata(dataDir, "cb-2", { worktree: "/tmp/w", branch: "v1", status: "working" });
    writeMetadata(dataDir, "cb-2", { worktree: "/tmp/w", branch: "v2", status: "working" });

    // Corrupt both
    writeFileSync(join(dataDir, "cb-2"), "garbage");
    writeFileSync(join(dataDir, "cb-2.backup"), "more_garbage");

    vi.spyOn(console, "warn").mockImplementation(() => {});

    const callback = vi.fn();
    const meta = readMetadata(dataDir, "cb-2", callback);

    expect(meta).toBeNull();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.stringContaining("cb-2"), false);
  });

  it("does not call callback when metadata is clean", () => {
    writeMetadata(dataDir, "cb-3", { worktree: "/tmp/w", branch: "main", status: "working" });

    const callback = vi.fn();
    const meta = readMetadata(dataDir, "cb-3", callback);

    expect(meta).not.toBeNull();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("listMetadata", () => {
  it("lists all session IDs", () => {
    writeMetadata(dataDir, "app-1", { worktree: "/tmp", branch: "a", status: "s" });
    writeMetadata(dataDir, "app-2", { worktree: "/tmp", branch: "b", status: "s" });
    writeMetadata(dataDir, "app-3", { worktree: "/tmp", branch: "c", status: "s" });

    const list = listMetadata(dataDir);
    expect(list).toHaveLength(3);
    expect(list.sort()).toEqual(["app-1", "app-2", "app-3"]);
  });

  it("excludes archive directory and dotfiles", () => {
    writeMetadata(dataDir, "app-1", { worktree: "/tmp", branch: "a", status: "s" });
    mkdirSync(join(dataDir, "archive"), { recursive: true });
    writeFileSync(join(dataDir, ".hidden"), "x", "utf-8");

    const list = listMetadata(dataDir);
    expect(list).toEqual(["app-1"]);
  });

  it("returns empty array when sessions dir does not exist", () => {
    const emptyDir = join(tmpdir(), `ao-test-empty-${randomUUID()}`);
    const list = listMetadata(emptyDir);
    expect(list).toEqual([]);
    // no cleanup needed since dir was never created
  });
});
