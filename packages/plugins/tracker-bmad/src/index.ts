/**
 * tracker-bmad plugin — BMad file-based task system as an issue tracker.
 *
 * Reads sprint-status.yaml and story-*.md files from the BMad output directory.
 * No external API calls — all data is local.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  PluginModule,
  Tracker,
  Issue,
  IssueFilters,
  IssueUpdate,
  ProjectConfig,
} from "@composio/ao-core";
import { appendHistory } from "./history.js";

export { readHistory } from "./history.js";
export type { HistoryEntry } from "./history.js";

// ---------------------------------------------------------------------------
// Public helpers (shared between CLI and web API)
// ---------------------------------------------------------------------------

/** Ordered BMad sprint columns — shared between CLI and web dashboard. */
export const BMAD_COLUMNS = ["backlog", "ready-for-dev", "in-progress", "review", "done"] as const;

/** A valid BMad sprint column name. */
export type BmadColumn = (typeof BMAD_COLUMNS)[number];

/**
 * Extract BMad status from an issue's labels (last label is the status).
 * Returns lowercase status string, falls back to "backlog".
 */
export function getBmadStatus(labels: string[]): string {
  if (labels.length === 0) return "backlog";
  const lastLabel = labels[labels.length - 1];
  if (!lastLabel) return "backlog";
  return lastLabel.toLowerCase();
}

/**
 * Categorize a BMad status into a high-level bucket.
 * Used by both CLI and web to compute sprint statistics consistently.
 */
export function categorizeStatus(bmadStatus: string): "done" | "in-progress" | "open" {
  if (bmadStatus === "done") return "done";
  if (bmadStatus === "in-progress" || bmadStatus === "review") return "in-progress";
  return "open";
}

/**
 * Read the H1 title from an epic markdown file.
 * Falls back to the epic slug if the file is missing or unreadable.
 */
export function readEpicTitle(epicSlug: string, project: ProjectConfig): string {
  const content = readFileOrNull(epicFilePath(epicSlug, project));
  if (!content) return epicSlug;
  return extractTitle(content, epicSlug);
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getOutputDir(project: ProjectConfig): string {
  const v = project.tracker?.["outputDir"];
  return typeof v === "string" ? v : "_bmad-output";
}

function getStoryDir(project: ProjectConfig): string {
  const v = project.tracker?.["storyDir"];
  return typeof v === "string" ? v : "implementation-artifacts";
}

function getBranchPrefix(project: ProjectConfig): string {
  const v = project.tracker?.["branchPrefix"];
  return typeof v === "string" ? v : "feat";
}

function getIncludeArchContext(project: ProjectConfig): boolean {
  const v = project.tracker?.["includeArchContext"];
  return typeof v === "boolean" ? v : false;
}

function getIncludePrdContext(project: ProjectConfig): boolean {
  const v = project.tracker?.["includePrdContext"];
  return typeof v === "boolean" ? v : false;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function sprintStatusPath(project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), "sprint-status.yaml");
}

function storyFilePath(identifier: string, project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), getStoryDir(project), `story-${identifier}.md`);
}

function techSpecPath(identifier: string, project: ProjectConfig): string {
  return join(
    project.path,
    getOutputDir(project),
    getStoryDir(project),
    `tech-spec-${identifier}.md`,
  );
}

function architecturePath(project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), "planning-artifacts", "architecture.md");
}

function prdPath(project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), "planning-artifacts", "prd.md");
}

function epicFilePath(epicSlug: string, project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), getStoryDir(project), `epic-${epicSlug}.md`);
}

// ---------------------------------------------------------------------------
// Sprint status YAML helpers
// ---------------------------------------------------------------------------

interface SprintStatusEntry {
  status: string;
  epic?: string;
  [key: string]: unknown;
}

interface SprintStatus {
  development_status: Record<string, SprintStatusEntry>;
  [key: string]: unknown;
}

function readSprintStatus(project: ProjectConfig): SprintStatus {
  const filePath = sprintStatusPath(project);
  if (!existsSync(filePath)) {
    throw new Error(`sprint-status.yaml not found at ${filePath}`);
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed: unknown = parseYaml(content);
    if (!parsed || typeof parsed !== "object" || !("development_status" in parsed)) {
      throw new Error("sprint-status.yaml missing 'development_status' key");
    }
    const devStatus = (parsed as SprintStatus).development_status;
    if (!devStatus || typeof devStatus !== "object" || Array.isArray(devStatus)) {
      throw new Error("sprint-status.yaml 'development_status' must be a mapping");
    }
    // Coerce non-string field values (YAML numbers, booleans) to strings
    // so downstream code can safely call .startsWith() etc.
    for (const entry of Object.values(devStatus)) {
      if (entry.status !== undefined && typeof entry.status !== "string") {
        entry.status = String(entry.status);
      }
      if (entry.epic !== undefined && typeof entry.epic !== "string") {
        entry.epic = String(entry.epic);
      }
    }

    return parsed as SprintStatus;
  } catch (err) {
    if (err instanceof Error && err.message.includes("sprint-status.yaml")) {
      throw err;
    }
    throw new Error(
      `Failed to parse sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

function readFileOrNull(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// State mapping
// ---------------------------------------------------------------------------

type BmadStatus = string;

function mapBmadState(status: BmadStatus): Issue["state"] {
  if (typeof status !== "string" || !status) return "open";
  const normalized = status.toLowerCase().replace(/[_\s]+/g, "-");
  switch (normalized) {
    case "done":
    case "epic-done":
      return "closed";
    case "in-progress":
    case "review":
    case "epic-in-progress":
      return "in_progress";
    case "backlog":
    case "ready-for-dev":
    case "epic-backlog":
    default:
      return "open";
  }
}

function reverseMapState(state: Issue["state"]): BmadStatus {
  switch (state) {
    case "closed":
    case "cancelled":
      return "done";
    case "in_progress":
      return "in-progress";
    case "open":
    default:
      return "ready-for-dev";
  }
}

// ---------------------------------------------------------------------------
// Story file parsing
// ---------------------------------------------------------------------------

function extractTitle(content: string, fallbackSlug: string): string {
  // Extract H1 from markdown
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallbackSlug;
}

function extractAcceptanceCriteria(storyContent: string): string[] {
  // Look for ## Acceptance Criteria section (case-insensitive)
  const acMatch = storyContent.match(/^##\s+acceptance\s+criteria\s*$/im);
  if (!acMatch || acMatch.index === undefined) return [];

  // Get content after the header until next H2 or EOF
  const afterHeader = storyContent.slice(acMatch.index + acMatch[0].length);
  const nextH2 = afterHeader.search(/^##\s/m);
  const section = nextH2 >= 0 ? afterHeader.slice(0, nextH2) : afterHeader;

  // Extract bullet items (- or * lines)
  const bullets: string[] = [];
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bullets.push(trimmed.slice(2).trim());
    }
  }

  return bullets;
}

function extractTechStack(archContent: string): string | null {
  // Look for ## Tech Stack or ## Technology section (case-insensitive)
  const techMatch = archContent.match(/^##\s+(tech\s+stack|technology)\s*$/im);
  if (!techMatch || techMatch.index === undefined) return null;

  // Get content after the header until next H2 or EOF
  const afterHeader = archContent.slice(techMatch.index + techMatch[0].length);
  const nextH2 = afterHeader.search(/^##\s/m);
  const section = nextH2 >= 0 ? afterHeader.slice(0, nextH2) : afterHeader;

  const trimmed = section.trim();
  return trimmed || null;
}

// ---------------------------------------------------------------------------
// Tracker implementation
// ---------------------------------------------------------------------------

function createBmadTracker(): Tracker {
  return {
    name: "bmad",

    async getIssue(identifier: string, project: ProjectConfig): Promise<Issue> {
      const sprint = readSprintStatus(project);
      const entry = sprint.development_status[identifier];

      if (!entry) {
        throw new Error(`Issue '${identifier}' not found in sprint-status.yaml`);
      }

      const storyContent = readFileOrNull(storyFilePath(identifier, project));
      const title = storyContent ? extractTitle(storyContent, identifier) : identifier;
      const description = storyContent ?? "";

      const status = typeof entry.status === "string" ? entry.status : "backlog";
      const labels: string[] = [];
      if (entry.epic) labels.push(entry.epic);
      labels.push(status);

      return {
        id: identifier,
        title,
        description,
        url: this.issueUrl(identifier, project),
        state: mapBmadState(status),
        labels,
      };
    },

    async isCompleted(identifier: string, project: ProjectConfig): Promise<boolean> {
      const sprint = readSprintStatus(project);
      const entry = sprint.development_status[identifier];
      if (!entry) return false;
      return mapBmadState(entry.status) === "closed";
    },

    issueUrl(identifier: string, project: ProjectConfig): string {
      const filePath = storyFilePath(identifier, project);
      // Encode path segments so spaces/special chars produce valid file:// URLs
      return `file://${encodeURI(filePath)}`;
    },

    issueLabel(url: string, _project: ProjectConfig): string {
      const match = url.match(/story-([^/]+)\.md/);
      return match ? match[1] : url;
    },

    branchName(identifier: string, project: ProjectConfig): string {
      const prefix = getBranchPrefix(project);
      // Sanitize identifier for git branch name safety
      const safe = identifier
        .replace(/[\s~^:?*[\]\\/]/g, "-")
        .replace(/\.{2,}/g, "-")
        .replace(/@\{/g, "-")
        .replace(/\.lock$/i, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");
      return `${prefix}/${safe || "story"}`;
    },

    async generatePrompt(identifier: string, project: ProjectConfig): Promise<string> {
      const issue = await this.getIssue(identifier, project);
      const lines: string[] = [];

      lines.push(`You are working on BMad story: ${issue.title}`);
      lines.push(`Identifier: ${identifier}`);
      lines.push("");

      // Story content
      if (issue.description) {
        lines.push("## Story", "", issue.description, "");
      }

      // Acceptance criteria checklist
      if (issue.description) {
        const criteria = extractAcceptanceCriteria(issue.description);
        if (criteria.length > 0) {
          lines.push("## Acceptance Criteria Checklist", "");
          for (const criterion of criteria) {
            lines.push(`- [ ] ${criterion}`);
          }
          lines.push("");
          lines.push("Verify each criterion is met before creating your PR.");
          lines.push("");
        }
      }

      // Architecture context
      if (getIncludeArchContext(project)) {
        const archContent = readFileOrNull(architecturePath(project));
        if (archContent) {
          // Extract tech stack first so it's visible even when architecture gets truncated
          const techStack = extractTechStack(archContent);
          if (techStack) {
            lines.push("## Tech Stack", "", techStack, "");
          }

          const truncated =
            archContent.length > 4000
              ? archContent.slice(0, 4000) + "\n\n[truncated]"
              : archContent;
          lines.push("## Architecture Context", "", truncated, "");
        }
      }

      // PRD context
      if (getIncludePrdContext(project)) {
        const prdContent = readFileOrNull(prdPath(project));
        if (prdContent) {
          const truncated =
            prdContent.length > 3000 ? prdContent.slice(0, 3000) + "\n\n[truncated]" : prdContent;
          lines.push("## Product Requirements", "", truncated, "");
        }
      }

      // Tech spec
      const techSpec = readFileOrNull(techSpecPath(identifier, project));
      if (techSpec) {
        const truncated =
          techSpec.length > 4000 ? techSpec.slice(0, 4000) + "\n\n[truncated]" : techSpec;
        lines.push("## Technical Specification", "", truncated, "");
      }

      // Epic context — derive epic from issue labels (already read by getIssue)
      const epicLabel = issue.labels.find((l) => l.startsWith("epic-"));
      if (epicLabel) {
        const epicContent = readFileOrNull(epicFilePath(epicLabel, project));
        if (epicContent) {
          const truncated =
            epicContent.length > 2000
              ? epicContent.slice(0, 2000) + "\n\n[truncated]"
              : epicContent;
          lines.push("## Epic Overview", "", truncated, "");
        }

        // Related stories in same epic (requires sprint status for sibling lookup)
        const sprint = readSprintStatus(project);
        const siblings: string[] = [];
        for (const [sibId, sibEntry] of Object.entries(sprint.development_status)) {
          if (sibId === identifier) continue;
          if (sibEntry.epic !== epicLabel) continue;
          if (siblings.length >= 10) break;

          const sibStoryContent = readFileOrNull(storyFilePath(sibId, project));
          const sibTitle = sibStoryContent ? extractTitle(sibStoryContent, sibId) : sibId;
          const sibStatus = typeof sibEntry.status === "string" ? sibEntry.status : "backlog";
          siblings.push(`- ${sibId}: ${sibTitle} [${sibStatus}]`);
        }

        if (siblings.length > 0) {
          lines.push("## Related Stories (same epic)", "");
          lines.push(...siblings);
          lines.push("");
        }
      }

      lines.push(
        "Please implement the changes described in this story. When done, commit and push your changes.",
      );

      return lines.join("\n");
    },

    async listIssues(filters: IssueFilters, project: ProjectConfig): Promise<Issue[]> {
      const sprint = readSprintStatus(project);
      const results: Issue[] = [];
      const limit = filters.limit ?? 30;

      for (const [identifier, entry] of Object.entries(sprint.development_status)) {
        if (results.length >= limit) break;

        const status = typeof entry.status === "string" ? entry.status : "backlog";

        // Skip epic-level entries — they inflate story counts
        if (identifier.startsWith("epic-") || status.startsWith("epic-")) continue;

        const mappedState = mapBmadState(status);

        // Filter by state
        if (filters.state && filters.state !== "all") {
          if (filters.state === "open" && mappedState !== "open" && mappedState !== "in_progress") {
            continue;
          }
          if (filters.state === "closed" && mappedState !== "closed") {
            continue;
          }
        }

        // Filter by labels
        if (filters.labels && filters.labels.length > 0) {
          const entryLabels = [entry.epic, status].filter(Boolean) as string[];
          const hasMatch = filters.labels.some((l) => entryLabels.includes(l));
          if (!hasMatch) continue;
        }

        const storyContent = readFileOrNull(storyFilePath(identifier, project));
        const title = storyContent ? extractTitle(storyContent, identifier) : identifier;

        const labels: string[] = [];
        if (entry.epic) labels.push(entry.epic);
        labels.push(status);

        results.push({
          id: identifier,
          title,
          description: storyContent ?? "",
          url: this.issueUrl(identifier, project),
          state: mappedState,
          labels,
        });
      }

      return results;
    },

    async updateIssue(
      identifier: string,
      update: IssueUpdate,
      project: ProjectConfig,
    ): Promise<void> {
      if (!update.state) return;

      const filePath = sprintStatusPath(project);
      if (!existsSync(filePath)) {
        throw new Error(`sprint-status.yaml not found at ${filePath}`);
      }
      const content = readFileSync(filePath, "utf-8");
      const sprint: unknown = parseYaml(content);

      if (!sprint || typeof sprint !== "object" || !("development_status" in sprint)) {
        throw new Error("sprint-status.yaml missing 'development_status' key");
      }

      const typed = sprint as SprintStatus;
      const entry = typed.development_status[identifier];
      if (!entry) {
        throw new Error(`Issue '${identifier}' not found in sprint-status.yaml`);
      }

      const oldStatus = typeof entry.status === "string" ? entry.status : "backlog";
      const newStatus = reverseMapState(update.state);

      entry.status = newStatus;
      const tmpPath = filePath + `.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmpPath, stringifyYaml(typed), "utf-8");
      renameSync(tmpPath, filePath);

      // Record history after successful write so retried transitions aren't missing
      appendHistory(project, identifier, oldStatus, newStatus);
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin module export
// ---------------------------------------------------------------------------

export const manifest = {
  name: "bmad",
  slot: "tracker" as const,
  description: "Tracker plugin: BMad file-based task system",
  version: "0.1.0",
};

export function create(): Tracker {
  return createBmadTracker();
}

export default { manifest, create } satisfies PluginModule<Tracker>;
