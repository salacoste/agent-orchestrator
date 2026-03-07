import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

// Mock node:fs before importing the module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("./history.js", () => ({
  appendHistory: vi.fn(),
  appendComment: vi.fn(),
}));

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import plugin, {
  manifest,
  create,
  readEpicTitle,
  getBmadStatus,
  BMAD_COLUMNS,
  categorizeStatus,
} from "./index.js";
import { appendHistory, appendComment } from "./history.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPRINT_STATUS_YAML = `
development_status:
  1-1-user-authentication:
    status: ready-for-dev
    epic: epic-1
  1-2-user-profile:
    status: in-progress
    epic: epic-1
  2-1-payment-integration:
    status: done
    epic: epic-2
  3-1-dashboard:
    status: backlog
    epic: epic-3
  4-1-review-flow:
    status: review
    epic: epic-1
  epic-1:
    status: epic-in-progress
  epic-2:
    status: epic-done
`;

const STORY_CONTENT = `# User Authentication

## Overview
Implement user authentication with OAuth2.

## Acceptance Criteria
- Users can sign in with Google
- JWT tokens are issued
`;

const ARCHITECTURE_CONTENT = `# Architecture

## Tech Stack
- Next.js 15
- PostgreSQL
- Redis

## System Design
This is the architecture document content for the project.
`;

const TECH_SPEC_CONTENT = `# Tech Spec: User Authentication

## Implementation Details
Use NextAuth.js with Google provider.
`;

const EPIC_CONTENT = `# Epic 1: User Management

## Overview
All user-related features including auth, profiles, and settings.
`;

const PRD_CONTENT = `# Product Requirements Document

## Goals
Build a user management platform with OAuth2 authentication.

## Features
- User sign-up and sign-in
- Profile management
- Role-based access control
`;

const PROJECT: ProjectConfig = {
  name: "Test App",
  repo: "org/test-app",
  path: "/home/user/test-app",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
    outputDir: "_bmad-output",
    storyDir: "implementation-artifacts",
    branchPrefix: "feat",
    includeArchContext: true,
  },
};

const PROJECT_DEFAULTS: ProjectConfig = {
  name: "Test App",
  repo: "org/test-app",
  path: "/home/user/test-app",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockRenameSync = renameSync as ReturnType<typeof vi.fn>;

function setupFs(overrides?: {
  sprintStatus?: string | null;
  story?: string | null;
  architecture?: string | null;
  techSpec?: string | null;
  epic?: string | null;
  prd?: string | null;
}) {
  const files: Record<string, string> = {};
  const sprintPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
  const storyPath =
    "/home/user/test-app/_bmad-output/implementation-artifacts/story-1-1-user-authentication.md";
  const archPath = "/home/user/test-app/_bmad-output/planning-artifacts/architecture.md";
  const techSpecPath =
    "/home/user/test-app/_bmad-output/implementation-artifacts/tech-spec-1-1-user-authentication.md";
  const epicPath = "/home/user/test-app/_bmad-output/implementation-artifacts/epic-epic-1.md";
  const prdFilePath = "/home/user/test-app/_bmad-output/planning-artifacts/prd.md";

  if (overrides?.sprintStatus !== null) {
    files[sprintPath] = overrides?.sprintStatus ?? SPRINT_STATUS_YAML;
  }
  if (overrides?.story !== null) {
    files[storyPath] = overrides?.story ?? STORY_CONTENT;
  }
  if (overrides?.architecture !== null) {
    files[archPath] = overrides?.architecture ?? ARCHITECTURE_CONTENT;
  }
  if (overrides?.techSpec !== null) {
    files[techSpecPath] = overrides?.techSpec ?? TECH_SPEC_CONTENT;
  }
  if (overrides?.epic !== null) {
    files[epicPath] = overrides?.epic ?? EPIC_CONTENT;
  }
  if (overrides?.prd !== null && overrides?.prd !== undefined) {
    files[prdFilePath] = overrides.prd;
  }

  mockExistsSync.mockImplementation((path: string) => path in files);
  mockReadFileSync.mockImplementation((path: string, _encoding: string) => {
    if (path in files) return files[path];
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("manifest", () => {
  it("has correct name and slot", () => {
    expect(manifest.name).toBe("bmad");
    expect(manifest.slot).toBe("tracker");
  });

  it("plugin module exports satisfy PluginModule", () => {
    expect(plugin.manifest).toBe(manifest);
    expect(typeof plugin.create).toBe("function");
  });
});

describe("BMAD_COLUMNS", () => {
  it("exports the five standard sprint columns in order", () => {
    expect(BMAD_COLUMNS).toEqual(["backlog", "ready-for-dev", "in-progress", "review", "done"]);
  });

  it("has exactly five columns", () => {
    expect(BMAD_COLUMNS).toHaveLength(5);
  });
});

describe("create", () => {
  it("returns a tracker with name 'bmad'", () => {
    const tracker = create();
    expect(tracker.name).toBe("bmad");
  });
});

describe("getIssue", () => {
  it("returns correct Issue from sprint-status.yaml + story file", async () => {
    setupFs();
    const tracker = create();
    const issue = await tracker.getIssue("1-1-user-authentication", PROJECT);

    expect(issue.id).toBe("1-1-user-authentication");
    expect(issue.title).toBe("User Authentication");
    expect(issue.state).toBe("open");
    expect(issue.labels).toContain("epic-1");
    expect(issue.labels).toContain("ready-for-dev");
    expect(issue.description).toContain("OAuth2");
    expect(issue.url).toContain("story-1-1-user-authentication.md");
  });

  it("throws 'not found' for missing identifier", async () => {
    setupFs();
    const tracker = create();
    await expect(tracker.getIssue("nonexistent", PROJECT)).rejects.toThrow(
      "Issue 'nonexistent' not found in sprint-status.yaml",
    );
  });

  it("gracefully handles missing story file (uses slug as title)", async () => {
    setupFs({ story: null });
    const tracker = create();
    const issue = await tracker.getIssue("1-1-user-authentication", PROJECT);

    expect(issue.title).toBe("1-1-user-authentication");
    expect(issue.description).toBe("");
  });

  it("gracefully handles empty story file (uses slug as title)", async () => {
    setupFs({ story: "" });
    const tracker = create();
    const issue = await tracker.getIssue("1-1-user-authentication", PROJECT);

    expect(issue.title).toBe("1-1-user-authentication");
    expect(issue.description).toBe("");
  });

  it("throws descriptive error for malformed YAML syntax", async () => {
    const malformedYaml = "development_status:\n  story-a:\n    status: [invalid yaml::";
    setupFs({ sprintStatus: malformedYaml });
    const tracker = create();

    await expect(tracker.getIssue("story-a", PROJECT)).rejects.toThrow(
      "Failed to parse sprint-status.yaml",
    );
  });

  it("throws when sprint-status.yaml has no development_status key", async () => {
    const yamlNoDev = "some_other_key:\n  value: true";
    setupFs({ sprintStatus: yamlNoDev });
    const tracker = create();

    await expect(tracker.getIssue("anything", PROJECT)).rejects.toThrow(
      "missing 'development_status' key",
    );
  });

  it("throws when development_status is a string instead of mapping", async () => {
    const yamlBadType = "development_status: not-a-mapping";
    setupFs({ sprintStatus: yamlBadType });
    const tracker = create();

    await expect(tracker.getIssue("anything", PROJECT)).rejects.toThrow(
      "'development_status' must be a mapping",
    );
  });

  it("throws when development_status is an array instead of mapping", async () => {
    const yamlArray = "development_status:\n  - item1\n  - item2";
    setupFs({ sprintStatus: yamlArray });
    const tracker = create();

    await expect(tracker.getIssue("anything", PROJECT)).rejects.toThrow(
      "'development_status' must be a mapping",
    );
  });

  it("returns empty list when development_status is an empty mapping", async () => {
    const yamlEmpty = "development_status: {}";
    setupFs({ sprintStatus: yamlEmpty });
    const tracker = create();

    const issues = await tracker.listIssues!({}, PROJECT);
    expect(issues).toEqual([]);
  });

  it("uses default config values when not specified", async () => {
    // Setup with default paths
    const files: Record<string, string> = {
      "/home/user/test-app/_bmad-output/sprint-status.yaml": SPRINT_STATUS_YAML,
      "/home/user/test-app/_bmad-output/implementation-artifacts/story-1-1-user-authentication.md":
        STORY_CONTENT,
    };
    mockExistsSync.mockImplementation((path: string) => path in files);
    mockReadFileSync.mockImplementation((path: string, _encoding: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });

    const tracker = create();
    const issue = await tracker.getIssue("1-1-user-authentication", PROJECT_DEFAULTS);

    expect(issue.title).toBe("User Authentication");
  });
});

describe("isCompleted", () => {
  it("returns true for 'done' status", async () => {
    setupFs();
    const tracker = create();
    expect(await tracker.isCompleted("2-1-payment-integration", PROJECT)).toBe(true);
  });

  it("returns false for 'in-progress' status", async () => {
    setupFs();
    const tracker = create();
    expect(await tracker.isCompleted("1-2-user-profile", PROJECT)).toBe(false);
  });

  it("returns false for 'ready-for-dev' status", async () => {
    setupFs();
    const tracker = create();
    expect(await tracker.isCompleted("1-1-user-authentication", PROJECT)).toBe(false);
  });

  it("returns false for unknown identifier", async () => {
    setupFs();
    const tracker = create();
    expect(await tracker.isCompleted("nonexistent", PROJECT)).toBe(false);
  });
});

describe("branchName", () => {
  it("returns correct format with configured prefix", () => {
    const tracker = create();
    expect(tracker.branchName("1-1-user-authentication", PROJECT)).toBe(
      "feat/1-1-user-authentication",
    );
  });

  it("uses default prefix when not configured", () => {
    const tracker = create();
    expect(tracker.branchName("1-1-user-authentication", PROJECT_DEFAULTS)).toBe(
      "feat/1-1-user-authentication",
    );
  });

  it("sanitizes spaces to dashes", () => {
    const tracker = create();
    expect(tracker.branchName("story with spaces", PROJECT)).toBe("feat/story-with-spaces");
  });

  it("sanitizes colons and special chars", () => {
    const tracker = create();
    expect(tracker.branchName("story:1?2*3", PROJECT)).toBe("feat/story-1-2-3");
  });

  it("sanitizes consecutive dots", () => {
    const tracker = create();
    expect(tracker.branchName("story..name", PROJECT)).toBe("feat/story-name");
  });

  it("strips .lock suffix (case-insensitive)", () => {
    const tracker = create();
    expect(tracker.branchName("story.lock", PROJECT)).toBe("feat/story");
    expect(tracker.branchName("story.LOCK", PROJECT)).toBe("feat/story");
  });

  it("collapses consecutive dashes", () => {
    const tracker = create();
    expect(tracker.branchName("story::name", PROJECT)).toBe("feat/story-name");
  });

  it("strips leading and trailing dashes", () => {
    const tracker = create();
    expect(tracker.branchName("-story-", PROJECT)).toBe("feat/story");
  });

  it("falls back to 'story' when identifier sanitizes to empty", () => {
    const tracker = create();
    expect(tracker.branchName("...", PROJECT)).toBe("feat/story");
  });

  it("sanitizes forward slashes from identifier", () => {
    const tracker = create();
    expect(tracker.branchName("some/nested/id", PROJECT)).toBe("feat/some-nested-id");
  });

  it("sanitizes @{ sequence from identifier", () => {
    const tracker = create();
    expect(tracker.branchName("story@{upstream}", PROJECT)).toBe("feat/story-upstream}");
  });

  it("falls back to 'story' for empty string identifier", () => {
    const tracker = create();
    expect(tracker.branchName("", PROJECT)).toBe("feat/story");
  });

  it("sanitizes tilde and caret characters", () => {
    const tracker = create();
    expect(tracker.branchName("HEAD~3^2", PROJECT)).toBe("feat/HEAD-3-2");
  });
});

describe("issueUrl", () => {
  it("returns file:// URL to story file", () => {
    const tracker = create();
    const url = tracker.issueUrl("1-1-user-authentication", PROJECT);
    expect(url).toBe(
      "file:///home/user/test-app/_bmad-output/implementation-artifacts/story-1-1-user-authentication.md",
    );
  });

  it("uses default paths when outputDir and storyDir not configured", () => {
    const tracker = create();
    const url = tracker.issueUrl("1-1-user-authentication", PROJECT_DEFAULTS);
    expect(url).toBe(
      "file:///home/user/test-app/_bmad-output/implementation-artifacts/story-1-1-user-authentication.md",
    );
  });

  it("always produces a file:// URL (not http)", () => {
    const tracker = create();
    const url = tracker.issueUrl("any-story", PROJECT);
    expect(url).toMatch(/^file:\/\//);
  });

  it("encodes spaces in project path", () => {
    const tracker = create();
    const projectWithSpaces = {
      ...PROJECT,
      path: "/home/user/My Project",
    };
    const url = tracker.issueUrl("1-1-auth", projectWithSpaces);
    expect(url).toContain("My%20Project");
    expect(url).not.toContain("My Project");
  });
});

describe("issueLabel", () => {
  it("extracts slug from story URL", () => {
    const tracker = create();
    const label = tracker.issueLabel!(
      "file:///home/user/test-app/_bmad-output/implementation-artifacts/story-1-1-user-authentication.md",
      PROJECT,
    );
    expect(label).toBe("1-1-user-authentication");
  });

  it("returns url as fallback when pattern does not match", () => {
    const tracker = create();
    const label = tracker.issueLabel!("https://example.com/other", PROJECT);
    expect(label).toBe("https://example.com/other");
  });

  it("extracts slug from nested path with story- prefix", () => {
    const tracker = create();
    const label = tracker.issueLabel!(
      "file:///home/user/project/_bmad-output/impl/story-2-1-payment.md",
      PROJECT,
    );
    expect(label).toBe("2-1-payment");
  });

  it("returns plain identifier as-is when not a URL", () => {
    const tracker = create();
    const label = tracker.issueLabel!("1-1-user-authentication", PROJECT);
    expect(label).toBe("1-1-user-authentication");
  });
});

describe("generatePrompt", () => {
  it("includes story content and architecture context", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("BMad story: User Authentication");
    expect(prompt).toContain("1-1-user-authentication");
    expect(prompt).toContain("OAuth2");
    expect(prompt).toContain("## Architecture Context");
    expect(prompt).toContain("Next.js 15");
    expect(prompt).toContain("## Technical Specification");
    expect(prompt).toContain("NextAuth.js");
    expect(prompt).toContain("## Epic Overview");
    expect(prompt).toContain("User Management");
  });

  it("omits architecture when includeArchContext is false", async () => {
    setupFs();
    const tracker = create();
    const projectNoArch: ProjectConfig = {
      ...PROJECT,
      tracker: { ...PROJECT.tracker!, includeArchContext: false },
    };
    const prompt = await tracker.generatePrompt("1-1-user-authentication", projectNoArch);

    expect(prompt).not.toContain("## Architecture Context");
  });

  it("truncates architecture content over 4000 chars", async () => {
    setupFs({ architecture: "A".repeat(5000) });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("[truncated]");
  });

  it("truncates epic content over 2000 chars", async () => {
    setupFs({ epic: "E".repeat(3000) });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("[truncated]");
  });

  it("includes PRD content when includePrdContext is true and prd.md exists", async () => {
    setupFs({ prd: PRD_CONTENT });
    const tracker = create();
    const projectWithPrd: ProjectConfig = {
      ...PROJECT,
      tracker: { ...PROJECT.tracker!, includePrdContext: true },
    };
    const prompt = await tracker.generatePrompt("1-1-user-authentication", projectWithPrd);

    expect(prompt).toContain("## Product Requirements");
    expect(prompt).toContain("OAuth2 authentication");
  });

  it("omits PRD content when includePrdContext is false (default)", async () => {
    setupFs({ prd: PRD_CONTENT });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).not.toContain("## Product Requirements");
  });

  it("truncates PRD content over 3000 chars", async () => {
    setupFs({ prd: "P".repeat(4000) });
    const tracker = create();
    const projectWithPrd: ProjectConfig = {
      ...PROJECT,
      tracker: { ...PROJECT.tracker!, includePrdContext: true },
    };
    const prompt = await tracker.generatePrompt("1-1-user-authentication", projectWithPrd);

    expect(prompt).toContain("## Product Requirements");
    expect(prompt).toContain("[truncated]");
  });

  it("truncates tech spec content over 4000 chars", async () => {
    setupFs({ techSpec: "T".repeat(5000) });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Technical Specification");
    expect(prompt).toContain("[truncated]");
    // Should contain at most 4000 chars of the spec, not the full 5000
    expect(prompt).not.toContain("T".repeat(5000));
  });

  it("includes acceptance criteria checklist when story has AC section", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Acceptance Criteria Checklist");
    expect(prompt).toContain("- [ ] Users can sign in with Google");
    expect(prompt).toContain("- [ ] JWT tokens are issued");
    expect(prompt).toContain("Verify each criterion is met before creating your PR.");
  });

  it("omits acceptance criteria checklist when story has no AC section", async () => {
    const storyWithoutAC = `# User Profile

## Overview
Implement user profile page.

## Implementation Notes
Some notes here.
`;
    setupFs({ story: storyWithoutAC });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).not.toContain("## Acceptance Criteria Checklist");
    expect(prompt).not.toContain("- [ ]");
  });

  it("extracts mixed bullet formats (- and *) from AC section", async () => {
    const storyWithMixedBullets = `# Mixed Bullets Story

## Acceptance Criteria
- First criterion with dash
* Second criterion with asterisk
- Third criterion with dash
* Fourth criterion with asterisk

## Implementation Notes
Some notes here.
`;
    setupFs({ story: storyWithMixedBullets });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Acceptance Criteria Checklist");
    expect(prompt).toContain("- [ ] First criterion with dash");
    expect(prompt).toContain("- [ ] Second criterion with asterisk");
    expect(prompt).toContain("- [ ] Third criterion with dash");
    expect(prompt).toContain("- [ ] Fourth criterion with asterisk");
  });

  it("stops extracting AC bullets at the next H2 heading", async () => {
    const storyWithNextH2 = `# Story With Sections

## Acceptance Criteria
- AC item one
- AC item two

## Technical Notes
- This is not an AC item
`;
    setupFs({ story: storyWithNextH2 });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("- [ ] AC item one");
    expect(prompt).toContain("- [ ] AC item two");
    expect(prompt).not.toContain("- [ ] This is not an AC item");
  });

  it("extracts tech stack from architecture with '## Tech Stack' header", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Tech Stack");
    expect(prompt).toContain("- Next.js 15");
    expect(prompt).toContain("- PostgreSQL");
    expect(prompt).toContain("- Redis");
  });

  it("extracts tech stack from architecture with '## Technology' header", async () => {
    const archWithTechnology = `# Architecture

## Technology
- TypeScript
- Docker
- Kubernetes

## System Design
Some design content.
`;
    setupFs({ architecture: archWithTechnology });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Tech Stack");
    expect(prompt).toContain("- TypeScript");
    expect(prompt).toContain("- Docker");
    expect(prompt).toContain("- Kubernetes");
  });

  it("omits tech stack section when architecture has no tech stack header", async () => {
    const archNoTechStack = `# Architecture

## System Design
Some design content only.

## Deployment
Deployment details.
`;
    setupFs({ architecture: archNoTechStack });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Architecture Context");
    expect(prompt).not.toContain("## Tech Stack");
  });

  it("places tech stack section before architecture context in the prompt", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    const techStackIndex = prompt.indexOf("## Tech Stack");
    const archContextIndex = prompt.indexOf("## Architecture Context");

    expect(techStackIndex).toBeGreaterThan(-1);
    expect(archContextIndex).toBeGreaterThan(-1);
    expect(techStackIndex).toBeLessThan(archContextIndex);
  });

  it("lists related stories in the same epic", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Related Stories (same epic)");
    expect(prompt).toContain("1-2-user-profile:");
    expect(prompt).toContain("[in-progress]");
    expect(prompt).toContain("4-1-review-flow:");
    expect(prompt).toContain("[review]");
  });

  it("excludes the current story from related stories", async () => {
    setupFs();
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    const relatedSection = prompt.split("## Related Stories (same epic)")[1];
    expect(relatedSection).toBeDefined();
    expect(relatedSection).not.toContain("- 1-1-user-authentication:");
  });

  it("limits related stories to 10 siblings", async () => {
    const entries: string[] = [];
    for (let i = 1; i <= 13; i++) {
      entries.push(`  sibling-${i}:\n    status: ready-for-dev\n    epic: epic-big`);
    }
    entries.push(`  target-story:\n    status: in-progress\n    epic: epic-big`);
    const bigSprintYaml = `development_status:\n${entries.join("\n")}`;
    const files: Record<string, string> = {
      "/home/user/test-app/_bmad-output/sprint-status.yaml": bigSprintYaml,
    };
    mockExistsSync.mockImplementation((path: string) => path in files);
    mockReadFileSync.mockImplementation((path: string, _encoding: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });

    const tracker = create();
    const prompt = await tracker.generatePrompt("target-story", PROJECT);

    expect(prompt).toContain("## Related Stories (same epic)");
    const relatedSection = prompt.split("## Related Stories (same epic)")[1];
    const siblingLines = relatedSection!.split("\n").filter((l) => l.startsWith("- sibling-"));
    expect(siblingLines.length).toBe(10);
  });

  it("omits related stories section when story has no epic", async () => {
    const noEpicYaml = `development_status:
  no-epic-story:
    status: ready-for-dev
  other-story:
    status: in-progress
    epic: epic-1`;
    const files: Record<string, string> = {
      "/home/user/test-app/_bmad-output/sprint-status.yaml": noEpicYaml,
    };
    mockExistsSync.mockImplementation((path: string) => path in files);
    mockReadFileSync.mockImplementation((path: string, _encoding: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });

    const tracker = create();
    const prompt = await tracker.generatePrompt("no-epic-story", PROJECT);

    expect(prompt).not.toContain("## Related Stories (same epic)");
  });

  it("renders sibling status as 'backlog' when sibling has missing status", async () => {
    const yamlWithMalformedSibling = `development_status:
  1-1-user-authentication:
    status: ready-for-dev
    epic: epic-1
  1-2-no-status:
    epic: epic-1
  epic-1:
    status: epic-in-progress`;
    setupFs({ sprintStatus: yamlWithMalformedSibling });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);

    expect(prompt).toContain("## Related Stories (same epic)");
    expect(prompt).toContain("1-2-no-status:");
    expect(prompt).toContain("[backlog]");
    expect(prompt).not.toContain("[undefined]");
  });
});

describe("listIssues", () => {
  it("returns all story issues (excludes epics) when state is 'all'", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all" }, PROJECT);

    // 5 stories, 2 epic entries filtered out
    expect(issues.length).toBe(5);
    expect(issues.every((i) => !i.id.startsWith("epic-"))).toBe(true);
  });

  it("filters by open state (includes open + in_progress)", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "open" }, PROJECT);

    const states = issues.map((i) => i.state);
    expect(states).not.toContain("closed");
    // 4 non-epic open/in_progress stories
    expect(issues.length).toBe(4);
  });

  it("filters by closed state", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "closed" }, PROJECT);

    expect(issues.every((i) => i.state === "closed")).toBe(true);
    // Only 1 non-epic closed story (2-1-payment-integration)
    expect(issues.length).toBe(1);
  });

  it("excludes entries where identifier starts with 'epic-'", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all" }, PROJECT);

    const ids = issues.map((i) => i.id);
    expect(ids).not.toContain("epic-1");
    expect(ids).not.toContain("epic-2");
  });

  it("excludes entries where status starts with 'epic-'", async () => {
    const yamlWithEpicStatus = `development_status:
  story-a:
    status: epic-in-progress
  story-b:
    status: ready-for-dev
    epic: epic-1`;
    const files: Record<string, string> = {
      "/home/user/test-app/_bmad-output/sprint-status.yaml": yamlWithEpicStatus,
    };
    mockExistsSync.mockImplementation((path: string) => path in files);
    mockReadFileSync.mockImplementation((path: string, _encoding: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });

    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all" }, PROJECT);

    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe("story-b");
  });

  it("respects limit", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all", limit: 2 }, PROJECT);

    expect(issues.length).toBe(2);
  });

  it("filters by labels (epic)", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all", labels: ["epic-2"] }, PROJECT);

    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe("2-1-payment-integration");
  });

  it("filters by labels (status)", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all", labels: ["in-progress"] }, PROJECT);

    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe("1-2-user-profile");
  });

  it("returns empty array when label filter matches nothing", async () => {
    setupFs();
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all", labels: ["nonexistent"] }, PROJECT);

    expect(issues).toHaveLength(0);
  });

  it("coerces non-string epic and status values from YAML", async () => {
    const yamlWithNonStringEpic = `
development_status:
  1-1-user-authentication:
    status: in-progress
    epic: 123
  2-1-data-model:
    status: true
    epic: null
`;
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.endsWith("sprint-status.yaml")) return yamlWithNonStringEpic;
      return "# Story\nTitle here";
    });

    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all" }, PROJECT);

    // Non-string epic 123 should be coerced to "123"
    const story1 = issues.find((i) => i.id === "1-1-user-authentication");
    expect(story1).toBeDefined();
    expect(story1!.labels).toContain("123");
    // .startsWith should work without crashing
    expect(story1!.labels.every((l) => typeof l === "string")).toBe(true);

    // Boolean status should be coerced to "true", null epic should be excluded
    const story2 = issues.find((i) => i.id === "2-1-data-model");
    expect(story2).toBeDefined();
    expect(story2!.labels.every((l) => typeof l === "string")).toBe(true);
  });
});

describe("updateIssue", () => {
  it("writes correct state back to YAML via atomic temp+rename", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!("1-1-user-authentication", { state: "in_progress" }, PROJECT);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [tmpPath, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    expect(tmpPath).toMatch(/sprint-status\.yaml\.tmp\.\d+\.\d+$/);
    expect(writtenContent).toContain("in-progress");

    expect(mockRenameSync).toHaveBeenCalledOnce();
    const [src, dest] = mockRenameSync.mock.calls[0] as [string, string];
    expect(src).toBe(tmpPath);
    expect(dest).toBe("/home/user/test-app/_bmad-output/sprint-status.yaml");
  });

  it("maps closed state to done", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!("1-1-user-authentication", { state: "closed" }, PROJECT);

    const [, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain("done");
  });

  it("maps open state to ready-for-dev", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!("1-2-user-profile", { state: "open" }, PROJECT);

    const [, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain("ready-for-dev");
  });

  it("throws for unknown identifier", async () => {
    setupFs();
    const tracker = create();

    await expect(tracker.updateIssue!("nonexistent", { state: "closed" }, PROJECT)).rejects.toThrow(
      "Issue 'nonexistent' not found",
    );
  });

  it("is a no-op when no state or comment in update", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!("1-1-user-authentication", { labels: ["test"] }, PROJECT);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(appendHistory).not.toHaveBeenCalled();
    expect(appendComment).not.toHaveBeenCalled();
  });

  it("appends comment to history when comment is provided with state change", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!(
      "1-1-user-authentication",
      { state: "closed", comment: "Merged via PR #42" },
      PROJECT,
    );

    expect(appendHistory).toHaveBeenCalledWith(
      PROJECT,
      "1-1-user-authentication",
      "ready-for-dev",
      "done",
    );
    expect(appendComment).toHaveBeenCalledWith(
      PROJECT,
      "1-1-user-authentication",
      "Merged via PR #42",
      "done",
    );
  });

  it("appends comment without state change", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!(
      "1-1-user-authentication",
      { comment: "Agent encountered a build error" },
      PROJECT,
    );

    // No YAML write or state transition
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(appendHistory).not.toHaveBeenCalled();
    // Comment still appended
    expect(appendComment).toHaveBeenCalledWith(
      PROJECT,
      "1-1-user-authentication",
      "Agent encountered a build error",
      "ready-for-dev",
    );
  });

  it("propagates renameSync failure and does not call appendHistory", async () => {
    setupFs();
    mockRenameSync.mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied");
    });
    const tracker = create();

    await expect(
      tracker.updateIssue!("1-1-user-authentication", { state: "closed" }, PROJECT),
    ).rejects.toThrow("EACCES");

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it("calls appendHistory with correct args after successful write", async () => {
    setupFs();
    const tracker = create();

    await tracker.updateIssue!("1-1-user-authentication", { state: "closed" }, PROJECT);

    expect(appendHistory).toHaveBeenCalledWith(
      PROJECT,
      "1-1-user-authentication",
      "ready-for-dev",
      "done",
    );
    // Verify ordering: write happens before appendHistory
    const writeOrder = mockWriteFileSync.mock.invocationCallOrder[0];
    const historyOrder = vi.mocked(appendHistory).mock.invocationCallOrder[0];
    expect(historyOrder).toBeGreaterThan(writeOrder!);
  });

  it("records oldStatus as 'backlog' when entry has missing status", async () => {
    setupFs({
      sprintStatus: `
development_status:
  1-1-no-status:
    epic: epic-1
`,
    });
    const tracker = create();
    await tracker.updateIssue!("1-1-no-status", { state: "closed" }, PROJECT);

    expect(appendHistory).toHaveBeenCalledWith(PROJECT, "1-1-no-status", "backlog", "done");
  });
});

describe("state mapping", () => {
  it("covers all BMad states", async () => {
    setupFs();
    const tracker = create();

    // ready-for-dev → open
    const readyIssue = await tracker.getIssue("1-1-user-authentication", PROJECT);
    expect(readyIssue.state).toBe("open");

    // in-progress → in_progress
    const inProgressIssue = await tracker.getIssue("1-2-user-profile", PROJECT);
    expect(inProgressIssue.state).toBe("in_progress");

    // done → closed
    const doneIssue = await tracker.getIssue("2-1-payment-integration", PROJECT);
    expect(doneIssue.state).toBe("closed");

    // backlog → open
    const backlogIssue = await tracker.getIssue("3-1-dashboard", PROJECT);
    expect(backlogIssue.state).toBe("open");

    // review → in_progress
    const reviewIssue = await tracker.getIssue("4-1-review-flow", PROJECT);
    expect(reviewIssue.state).toBe("in_progress");

    // epic-in-progress → in_progress
    const epicInProgress = await tracker.getIssue("epic-1", PROJECT);
    expect(epicInProgress.state).toBe("in_progress");

    // epic-done → closed
    const epicDone = await tracker.getIssue("epic-2", PROJECT);
    expect(epicDone.state).toBe("closed");
  });
});

describe("getBmadStatus", () => {
  it("returns last label lowercased", () => {
    expect(getBmadStatus(["epic-1", "in-progress"])).toBe("in-progress");
  });

  it("returns 'backlog' for empty labels", () => {
    expect(getBmadStatus([])).toBe("backlog");
  });

  it("lowercases the status", () => {
    expect(getBmadStatus(["epic-1", "Ready-For-Dev"])).toBe("ready-for-dev");
  });

  it("handles single-label array", () => {
    expect(getBmadStatus(["done"])).toBe("done");
  });
});

describe("categorizeStatus", () => {
  it("returns 'done' for done status", () => {
    expect(categorizeStatus("done")).toBe("done");
  });

  it("returns 'in-progress' for in-progress status", () => {
    expect(categorizeStatus("in-progress")).toBe("in-progress");
  });

  it("returns 'in-progress' for review status", () => {
    expect(categorizeStatus("review")).toBe("in-progress");
  });

  it("returns 'open' for backlog status", () => {
    expect(categorizeStatus("backlog")).toBe("open");
  });

  it("returns 'open' for ready-for-dev status", () => {
    expect(categorizeStatus("ready-for-dev")).toBe("open");
  });

  it("returns 'open' for unknown status", () => {
    expect(categorizeStatus("custom-status")).toBe("open");
  });
});

describe("readEpicTitle", () => {
  it("returns H1 title from epic markdown file", () => {
    setupFs();
    const title = readEpicTitle("epic-1", PROJECT);
    expect(title).toBe("Epic 1: User Management");
  });

  it("falls back to slug when file does not exist", () => {
    setupFs({ epic: null });
    const title = readEpicTitle("epic-1", PROJECT);
    expect(title).toBe("epic-1");
  });

  it("falls back to slug when file has no H1", () => {
    setupFs({ epic: "No heading here\n\nJust paragraphs." });
    const title = readEpicTitle("epic-1", PROJECT);
    expect(title).toBe("epic-1");
  });

  it("uses default config paths when not specified", () => {
    setupFs();
    const title = readEpicTitle("epic-1", PROJECT_DEFAULTS);
    expect(title).toBe("Epic 1: User Management");
  });
});

describe("tracker.getEpicTitle", () => {
  it("delegates to readEpicTitle via the tracker interface", () => {
    setupFs();
    const tracker = create();
    expect(tracker.getEpicTitle).toBeDefined();
    const title = tracker.getEpicTitle!("epic-1", PROJECT);
    expect(title).toBe("Epic 1: User Management");
  });

  it("falls back to slug when epic file is missing", () => {
    setupFs({ epic: null });
    const tracker = create();
    const title = tracker.getEpicTitle!("epic-missing", PROJECT);
    expect(title).toBe("epic-missing");
  });
});

// ---------------------------------------------------------------------------
// Malformed YAML resilience
// ---------------------------------------------------------------------------

describe("malformed YAML entries", () => {
  it("treats entry with missing status as open", async () => {
    setupFs({
      sprintStatus: `
development_status:
  1-1-no-status:
    epic: epic-1
`,
    });
    const tracker = create();
    const issue = await tracker.getIssue("1-1-no-status", PROJECT);
    expect(issue.state).toBe("open");
  });

  it("treats entry with numeric status as open", async () => {
    setupFs({
      sprintStatus: `
development_status:
  1-1-numeric:
    status: 42
    epic: epic-1
`,
    });
    const tracker = create();
    const issue = await tracker.getIssue("1-1-numeric", PROJECT);
    expect(issue.state).toBe("open");
  });

  it("lists issues with missing status without crashing", async () => {
    setupFs({
      sprintStatus: `
development_status:
  1-1-no-status:
    epic: epic-1
  1-2-has-status:
    status: done
    epic: epic-1
`,
    });
    const tracker = create();
    const issues = await tracker.listIssues!({ state: "all" }, PROJECT);
    expect(issues).toHaveLength(2);
    expect(issues[0]?.state).toBe("open");
    expect(issues[1]?.state).toBe("closed");
  });
});

// ---------------------------------------------------------------------------
// extractAcceptanceCriteria edge cases (via generatePrompt)
// ---------------------------------------------------------------------------

describe("extractAcceptanceCriteria edge cases", () => {
  it("extracts * bullet items as well as - bullets", async () => {
    setupFs({
      story: `# Test Story

## Acceptance Criteria
* First criterion using asterisk
- Second criterion using dash
* Third criterion using asterisk
`,
    });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);
    expect(prompt).toContain("- [ ] First criterion using asterisk");
    expect(prompt).toContain("- [ ] Second criterion using dash");
    expect(prompt).toContain("- [ ] Third criterion using asterisk");
  });

  it("ignores numbered lists in AC section", async () => {
    setupFs({
      story: `# Test Story

## Acceptance Criteria
1. First numbered item
2. Second numbered item
- Real bullet item
`,
    });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);
    // Numbered items appear in Story section but NOT as checklist items
    const acSection = prompt.split("## Acceptance Criteria Checklist")[1]?.split("##")[0] ?? "";
    expect(acSection).not.toContain("First numbered item");
    expect(acSection).not.toContain("Second numbered item");
    expect(acSection).toContain("- [ ] Real bullet item");
  });

  it("returns no AC checklist when section exists but has no bullets", async () => {
    setupFs({
      story: `# Test Story

## Acceptance Criteria

Just a paragraph with no bullets.

## Next Section
`,
    });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);
    expect(prompt).not.toContain("Acceptance Criteria Checklist");
  });

  it("handles AC section at end of file without trailing newline", async () => {
    setupFs({
      story: `# Test Story

## Acceptance Criteria
- Only criterion`,
    });
    const tracker = create();
    const prompt = await tracker.generatePrompt("1-1-user-authentication", PROJECT);
    expect(prompt).toContain("- [ ] Only criterion");
  });
});

// ---------------------------------------------------------------------------
// validateIssue
// ---------------------------------------------------------------------------

describe("validateIssue", () => {
  it("returns valid for a well-formed ready-for-dev story", async () => {
    setupFs();
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // Tech spec exists, so no warning for it
  });

  it("returns error when story file is missing", async () => {
    setupFs({ story: null });
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("not found")]));
  });

  it("returns error when story file is empty", async () => {
    setupFs({ story: "" });
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("empty")]));
  });

  it("returns error when story has no title (no H1)", async () => {
    setupFs({
      story: `## No H1 here

## Acceptance Criteria
- Some criterion`,
    });
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("no title")]));
  });

  it("returns error when story has no acceptance criteria", async () => {
    setupFs({
      story: `# A Story

## Overview
Some overview but no AC section.`,
    });
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("acceptance criteria")]),
    );
  });

  it("returns error when status is done", async () => {
    setupFs();
    const tracker = create();
    // 2-1-payment-integration has status: done
    const result = await tracker.validateIssue!("2-1-payment-integration", PROJECT);
    // Story file won't exist for this identifier with setupFs defaults,
    // so it will fail on missing file first. Let's set up the story file.
    expect(result.valid).toBe(false);
  });

  it("returns error for done status with valid story content", async () => {
    // Create custom sprint status where our test story is done
    const yaml = `
development_status:
  test-story:
    status: done
    epic: epic-1`;
    setupFs({ sprintStatus: yaml, story: STORY_CONTENT });
    // Override existsSync to also find the story for "test-story"
    const storyPath =
      "/home/user/test-app/_bmad-output/implementation-artifacts/story-test-story.md";
    const sprintPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
    const techSpecPath =
      "/home/user/test-app/_bmad-output/implementation-artifacts/tech-spec-test-story.md";
    mockExistsSync.mockImplementation(
      (p: string) => p === sprintPath || p === storyPath || p === techSpecPath,
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === sprintPath) return yaml;
      if (p === storyPath) return STORY_CONTENT;
      if (p === techSpecPath) return TECH_SPEC_CONTENT;
      throw new Error(`ENOENT: ${p}`);
    });

    const tracker = create();
    const result = await tracker.validateIssue!("test-story", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("already completed")]),
    );
  });

  it("returns error for in-progress status", async () => {
    const yaml = `
development_status:
  test-story:
    status: in-progress
    epic: epic-1`;
    const storyPath =
      "/home/user/test-app/_bmad-output/implementation-artifacts/story-test-story.md";
    const sprintPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
    mockExistsSync.mockImplementation((p: string) => p === sprintPath || p === storyPath);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === sprintPath) return yaml;
      if (p === storyPath) return STORY_CONTENT;
      throw new Error(`ENOENT: ${p}`);
    });

    const tracker = create();
    const result = await tracker.validateIssue!("test-story", PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("already in progress")]),
    );
  });

  it("returns valid for backlog status", async () => {
    setupFs();
    // 3-1-dashboard has status: backlog
    // Need story file for this identifier
    const storyPath =
      "/home/user/test-app/_bmad-output/implementation-artifacts/story-3-1-dashboard.md";
    const techSpecPath =
      "/home/user/test-app/_bmad-output/implementation-artifacts/tech-spec-3-1-dashboard.md";
    const sprintPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
    mockExistsSync.mockImplementation(
      (p: string) => p === sprintPath || p === storyPath || p === techSpecPath,
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === sprintPath) return SPRINT_STATUS_YAML;
      if (p === storyPath) return STORY_CONTENT;
      if (p === techSpecPath) return TECH_SPEC_CONTENT;
      throw new Error(`ENOENT: ${p}`);
    });

    const tracker = create();
    const result = await tracker.validateIssue!("3-1-dashboard", PROJECT);
    expect(result.valid).toBe(true);
  });

  it("returns warning when tech spec is missing", async () => {
    setupFs({ techSpec: null });
    const tracker = create();
    const result = await tracker.validateIssue!("1-1-user-authentication", PROJECT);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("tech spec")]));
  });
});

// ---------------------------------------------------------------------------
// createIssue
// ---------------------------------------------------------------------------

describe("createIssue", () => {
  it("creates a new story with auto-incremented ID", async () => {
    setupFs();
    const tracker = create();

    const issue = await tracker.createIssue!(
      { title: "New Feature", description: "A cool feature", labels: [] },
      PROJECT,
    );

    expect(issue.id).toBe("s3"); // highest existing numeric suffix is 2 (from 2-1)
    expect(issue.title).toBe("New Feature");
    expect(issue.state).toBe("open");
    expect(issue.labels).toContain("backlog");

    // Should have written the YAML and story file
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("includes epic label in sprint status entry", async () => {
    setupFs();
    const tracker = create();

    const issue = await tracker.createIssue!(
      { title: "Auth Story", description: "", labels: ["epic-auth"] },
      PROJECT,
    );

    expect(issue.labels).toContain("epic-auth");
    expect(issue.labels).toContain("backlog");
  });

  it("throws when title is empty", async () => {
    setupFs();
    const tracker = create();

    await expect(tracker.createIssue!({ title: "", description: "" }, PROJECT)).rejects.toThrow(
      "Title is required",
    );
  });

  it("records history for the new story", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.createIssue!({ title: "New Feature", description: "" }, PROJECT);

    expect(mockAppendHistory).toHaveBeenCalledWith(
      PROJECT,
      expect.stringMatching(/^s\d+$/),
      "",
      "backlog",
    );
  });
});

// ---------------------------------------------------------------------------
// findIssueByBranch
// ---------------------------------------------------------------------------

describe("findIssueByBranch", () => {
  it("finds story by branch name", async () => {
    setupFs();
    const tracker = create();

    const result = await tracker.findIssueByBranch!("feat/1-1-user-authentication-impl", PROJECT);
    expect(result).toBe("1-1-user-authentication");
  });

  it("returns null when no match", async () => {
    setupFs();
    const tracker = create();

    const result = await tracker.findIssueByBranch!("feat/unknown-story", PROJECT);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// onPRMerge
// ---------------------------------------------------------------------------

describe("onPRMerge", () => {
  it("transitions story to done", async () => {
    setupFs();
    const tracker = create();

    await tracker.onPRMerge!("1-2-user-profile", undefined, PROJECT);

    // Should have written updated YAML
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onSessionDeath
// ---------------------------------------------------------------------------

describe("onSessionDeath", () => {
  it("resets in-progress story to ready-for-dev", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("1-2-user-profile", PROJECT);

    // Should write updated YAML
    expect(mockWriteFileSync).toHaveBeenCalled();
    // Should record history
    expect(mockAppendHistory).toHaveBeenCalledWith(
      PROJECT,
      "1-2-user-profile",
      "in-progress",
      "ready-for-dev",
    );
  });

  it("does not reset review status", async () => {
    setupFs();
    mockWriteFileSync.mockClear();
    const tracker = create();

    await tracker.onSessionDeath!("4-1-review-flow", PROJECT);

    // writeStoryStatus should NOT be called since status is "review" not "in-progress"
    // However the existing writeFileSync calls from setupFs may interfere, check appendHistory
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    expect(mockAppendHistory).not.toHaveBeenCalledWith(
      expect.anything(),
      "4-1-review-flow",
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not reset done status", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("2-1-payment-integration", PROJECT);

    expect(mockAppendHistory).not.toHaveBeenCalledWith(
      expect.anything(),
      "2-1-payment-integration",
      expect.anything(),
      expect.anything(),
    );
  });

  it("does nothing for unknown story", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("nonexistent", PROJECT);

    expect(mockAppendHistory).not.toHaveBeenCalled();
  });

  it("respects autoResetOnDeath=false config", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    const projectWithDisable: ProjectConfig = {
      ...PROJECT,
      tracker: { ...PROJECT.tracker!, autoResetOnDeath: false },
    };

    await tracker.onSessionDeath!("1-2-user-profile", projectWithDisable);

    expect(mockAppendHistory).not.toHaveBeenCalledWith(
      expect.anything(),
      "1-2-user-profile",
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not reset if assignedSession does not match dying session", async () => {
    const statusPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
    const assignedYaml = `
development_status:
  1-2-user-profile:
    status: in-progress
    epic: epic-1
    assignedSession: session-A
`;
    mockExistsSync.mockImplementation((p: string) => p === statusPath);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === statusPath) return assignedYaml;
      return "";
    });

    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("1-2-user-profile", PROJECT, "session-B");

    expect(mockAppendHistory).not.toHaveBeenCalledWith(
      expect.anything(),
      "1-2-user-profile",
      expect.anything(),
      expect.anything(),
    );
  });

  it("resets if assignedSession matches dying session", async () => {
    const statusPath = "/home/user/test-app/_bmad-output/sprint-status.yaml";
    const assignedYaml = `
development_status:
  1-2-user-profile:
    status: in-progress
    epic: epic-1
    assignedSession: session-A
`;
    mockExistsSync.mockImplementation((p: string) => p === statusPath);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === statusPath) return assignedYaml;
      return "";
    });

    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("1-2-user-profile", PROJECT, "session-A");

    expect(mockAppendHistory).toHaveBeenCalledWith(
      PROJECT,
      "1-2-user-profile",
      "in-progress",
      "ready-for-dev",
    );
  });

  it("resets if no sessionId provided (backward compat)", async () => {
    setupFs();
    const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;
    const tracker = create();

    await tracker.onSessionDeath!("1-2-user-profile", PROJECT);

    expect(mockAppendHistory).toHaveBeenCalledWith(
      PROJECT,
      "1-2-user-profile",
      "in-progress",
      "ready-for-dev",
    );
  });
});
