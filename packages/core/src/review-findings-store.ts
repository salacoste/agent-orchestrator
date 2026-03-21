/**
 * Review Findings Store — JSONL storage for code review findings
 *
 * Follows LearningStore pattern: append-only JSONL, load on startup, query by filters.
 */

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ReviewFinding } from "./types.js";

/** Configuration for the review findings store */
export interface ReviewFindingsStoreConfig {
  /** Path to review-findings.jsonl */
  findingsPath: string;
}

/** Review findings store interface */
export interface ReviewFindingsStore {
  /** Store a new finding */
  store(finding: Omit<ReviewFinding, "findingId" | "capturedAt">): Promise<string>;
  /** List all findings */
  list(): ReviewFinding[];
  /** Query findings by filters */
  query(params: {
    storyId?: string;
    agentId?: string;
    severity?: ReviewFinding["severity"];
    category?: string;
  }): ReviewFinding[];
  /** Load from disk */
  start(): Promise<void>;
}

class ReviewFindingsStoreImpl implements ReviewFindingsStore {
  private entries: ReviewFinding[] = [];
  private readonly findingsPath: string;

  constructor(config: ReviewFindingsStoreConfig) {
    this.findingsPath = config.findingsPath;
  }

  async start(): Promise<void> {
    if (!existsSync(this.findingsPath)) return;
    try {
      const content = await readFile(this.findingsPath, "utf-8");
      for (const line of content.trim().split("\n")) {
        if (!line) continue;
        try {
          this.entries.push(JSON.parse(line) as ReviewFinding);
        } catch {
          // Skip malformed
        }
      }
    } catch {
      // File read failure
    }
  }

  async store(finding: Omit<ReviewFinding, "findingId" | "capturedAt">): Promise<string> {
    const findingId = randomUUID();
    const full: ReviewFinding = {
      ...finding,
      findingId,
      capturedAt: new Date().toISOString(),
    };
    this.entries.push(full);

    const dir = dirname(this.findingsPath);
    await mkdir(dir, { recursive: true });
    await appendFile(this.findingsPath, JSON.stringify(full) + "\n", "utf-8");

    return findingId;
  }

  list(): ReviewFinding[] {
    return [...this.entries];
  }

  query(params: {
    storyId?: string;
    agentId?: string;
    severity?: ReviewFinding["severity"];
    category?: string;
  }): ReviewFinding[] {
    let results = [...this.entries];
    if (params.storyId) results = results.filter((f) => f.storyId === params.storyId);
    if (params.agentId) results = results.filter((f) => f.agentId === params.agentId);
    if (params.severity) results = results.filter((f) => f.severity === params.severity);
    if (params.category) results = results.filter((f) => f.category === params.category);
    return results;
  }
}

/** Factory function */
export function createReviewFindingsStore(config: ReviewFindingsStoreConfig): ReviewFindingsStore {
  return new ReviewFindingsStoreImpl(config);
}
