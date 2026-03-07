import { describe, it, expect } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";
import {
  getWorkflowColumns,
  getColumns,
  getColumnLabel,
  getColumnColor,
  isValidColumn,
  isBackwardTransition,
  categorizeStatusFromConfig,
} from "./workflow-columns.js";

const BASE_PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/tmp/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad" },
};

function withColumns(columns: unknown[]): ProjectConfig {
  return { ...BASE_PROJECT, tracker: { plugin: "bmad", columns } };
}

describe("getWorkflowColumns", () => {
  it("returns defaults when no columns configured", () => {
    const wf = getWorkflowColumns(BASE_PROJECT);
    expect(wf.all).toEqual(["backlog", "ready-for-dev", "in-progress", "review", "done"]);
    expect(wf.doneColumn).toBe("done");
    expect(wf.activeColumns.has("in-progress")).toBe(true);
    expect(wf.activeColumns.has("review")).toBe(true);
    expect(wf.openColumns.has("backlog")).toBe(true);
    expect(wf.openColumns.has("ready-for-dev")).toBe(true);
  });

  it("reads custom columns from config", () => {
    const project = withColumns([
      { id: "todo", label: "To Do", category: "open" },
      { id: "wip", label: "Work In Progress", category: "active" },
      { id: "qa", label: "QA Testing", category: "active" },
      { id: "shipped", label: "Shipped", category: "done" },
    ]);
    const wf = getWorkflowColumns(project);
    expect(wf.all).toEqual(["todo", "wip", "qa", "shipped"]);
    expect(wf.doneColumn).toBe("shipped");
    expect(wf.activeColumns.has("wip")).toBe(true);
    expect(wf.activeColumns.has("qa")).toBe(true);
    expect(wf.openColumns.has("todo")).toBe(true);
  });

  it("falls back to defaults for empty or invalid columns array", () => {
    expect(getColumns(withColumns([]))).toEqual([
      "backlog",
      "ready-for-dev",
      "in-progress",
      "review",
      "done",
    ]);
    expect(getColumns(withColumns([{ bad: true }]))).toEqual([
      "backlog",
      "ready-for-dev",
      "in-progress",
      "review",
      "done",
    ]);
  });
});

describe("getColumnLabel", () => {
  it("returns label for known column", () => {
    expect(getColumnLabel(BASE_PROJECT, "in-progress")).toBe("In Progress");
  });

  it("returns id for unknown column", () => {
    expect(getColumnLabel(BASE_PROJECT, "unknown-col")).toBe("unknown-col");
  });
});

describe("getColumnColor", () => {
  it("returns color for known column", () => {
    expect(getColumnColor(BASE_PROJECT, "done")).toBe("green-700");
  });

  it("returns default for unknown column", () => {
    expect(getColumnColor(BASE_PROJECT, "unknown")).toBe("zinc-700");
  });
});

describe("isValidColumn", () => {
  it("returns true for valid default columns", () => {
    expect(isValidColumn(BASE_PROJECT, "backlog")).toBe(true);
    expect(isValidColumn(BASE_PROJECT, "done")).toBe(true);
  });

  it("returns false for invalid columns", () => {
    expect(isValidColumn(BASE_PROJECT, "invalid")).toBe(false);
  });

  it("validates against custom columns", () => {
    const project = withColumns([
      { id: "todo", label: "To Do", category: "open" },
      { id: "done", label: "Done", category: "done" },
    ]);
    expect(isValidColumn(project, "todo")).toBe(true);
    expect(isValidColumn(project, "backlog")).toBe(false);
  });
});

describe("isBackwardTransition", () => {
  it("detects backward transitions", () => {
    expect(isBackwardTransition(BASE_PROJECT, "review", "in-progress")).toBe(true);
    expect(isBackwardTransition(BASE_PROJECT, "done", "backlog")).toBe(true);
  });

  it("returns false for forward transitions", () => {
    expect(isBackwardTransition(BASE_PROJECT, "backlog", "in-progress")).toBe(false);
    expect(isBackwardTransition(BASE_PROJECT, "in-progress", "done")).toBe(false);
  });

  it("returns false for same-column transition", () => {
    expect(isBackwardTransition(BASE_PROJECT, "review", "review")).toBe(false);
  });

  it("returns false for unknown columns", () => {
    expect(isBackwardTransition(BASE_PROJECT, "unknown", "done")).toBe(false);
  });
});

describe("categorizeStatusFromConfig", () => {
  it("categorizes default columns", () => {
    expect(categorizeStatusFromConfig(BASE_PROJECT, "done")).toBe("done");
    expect(categorizeStatusFromConfig(BASE_PROJECT, "in-progress")).toBe("in-progress");
    expect(categorizeStatusFromConfig(BASE_PROJECT, "review")).toBe("in-progress");
    expect(categorizeStatusFromConfig(BASE_PROJECT, "backlog")).toBe("open");
  });

  it("categorizes custom columns", () => {
    const project = withColumns([
      { id: "todo", label: "To Do", category: "open" },
      { id: "qa", label: "QA", category: "active" },
      { id: "shipped", label: "Shipped", category: "done" },
    ]);
    expect(categorizeStatusFromConfig(project, "qa")).toBe("in-progress");
    expect(categorizeStatusFromConfig(project, "shipped")).toBe("done");
    expect(categorizeStatusFromConfig(project, "todo")).toBe("open");
  });

  it("falls back for unknown statuses", () => {
    expect(categorizeStatusFromConfig(BASE_PROJECT, "unknown")).toBe("open");
  });
});
