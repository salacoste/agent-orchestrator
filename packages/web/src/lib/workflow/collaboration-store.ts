/**
 * Collaboration JSONL persistence (Story 39.2).
 *
 * Persists decisions and claims to JSONL files so they survive server restarts.
 * Presence is NOT persisted (ephemeral by nature).
 *
 * Uses the 39.1 broadcasting API to subscribe to changes — no modifications
 * needed to the core collaboration module.
 */
import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  subscribeCollaborationChanges,
  type CollaborationEvent,
  type Decision,
  type ReviewClaim,
} from "./collaboration";

/** Internal state — populated by initCollaborationStore. */
let storeDir: string | null = null;
let unsubscribe: (() => void) | null = null;
let writeChain: Promise<void> = Promise.resolve();

/**
 * Initialize collaboration persistence.
 *
 * Loads existing decisions and claims from disk, then subscribes to
 * future changes via the collaboration broadcasting system.
 *
 * Calling init again automatically stops the previous instance first.
 *
 * @param dir — directory for JSONL files (default: `$cwd/.ao-collaboration`)
 * @param injectDecisions — callback to inject loaded decisions into collaboration module
 * @param injectClaims — callback to inject loaded claims into collaboration module
 */
export async function initCollaborationStore(
  dir?: string,
  injectDecisions?: (decisions: Decision[]) => void,
  injectClaims?: (claims: ReviewClaim[]) => void,
): Promise<void> {
  // H1 fix: clean up any previous instance to prevent subscription leaks
  stopCollaborationStore();

  storeDir = dir ?? join(process.cwd(), ".ao-collaboration");

  // Ensure directory exists
  await mkdir(storeDir, { recursive: true });

  // Load persisted data with shape validation
  const decisions = await loadDecisions(join(storeDir, "decisions.jsonl"));
  const claims = await loadClaimEvents(join(storeDir, "claims.jsonl"));

  // Inject loaded data into collaboration module
  if (injectDecisions && decisions.length > 0) {
    injectDecisions(decisions);
  }
  if (injectClaims && claims.length > 0) {
    // Only inject the latest state per itemId (last event wins)
    const latestClaims = resolveLatestClaims(claims);
    injectClaims(latestClaims);
  }

  // Subscribe to future changes, chaining writes sequentially for flush()
  unsubscribe = subscribeCollaborationChanges((event) => {
    writeChain = writeChain.then(() => persistEvent(event));
  });
}

/** Stop persistence and unsubscribe. */
export function stopCollaborationStore(): void {
  unsubscribe?.();
  unsubscribe = null;
  storeDir = null;
  writeChain = Promise.resolve();
}

/** Await all pending writes. Use in tests to avoid setTimeout races. */
export async function flushCollaborationStore(): Promise<void> {
  await writeChain;
}

// ---------------------------------------------------------------------------
// Internal: JSONL read/write with shape validation
// ---------------------------------------------------------------------------

interface ClaimEvent {
  action: "claim" | "unclaim";
  data: ReviewClaim;
  timestamp: string;
}

/** Load and validate Decision entries from JSONL. */
async function loadDecisions(path: string): Promise<Decision[]> {
  const raw = await loadJsonlRaw(path);
  return raw.filter(isValidDecision);
}

/** Load and validate ClaimEvent entries from JSONL. */
async function loadClaimEvents(path: string): Promise<ClaimEvent[]> {
  const raw = await loadJsonlRaw(path);
  return raw.filter(isValidClaimEvent);
}

/** Shape guard for Decision — checks required fields exist. */
function isValidDecision(obj: unknown): obj is Decision {
  if (!obj || typeof obj !== "object") return false;
  const d = obj as Record<string, unknown>;
  return typeof d.who === "string" && typeof d.what === "string" && typeof d.why === "string";
}

/** Shape guard for ClaimEvent — checks required fields exist. */
function isValidClaimEvent(obj: unknown): obj is ClaimEvent {
  if (!obj || typeof obj !== "object") return false;
  const e = obj as Record<string, unknown>;
  if (e.action !== "claim" && e.action !== "unclaim") return false;
  if (!e.data || typeof e.data !== "object") return false;
  const d = e.data as Record<string, unknown>;
  return typeof d.itemId === "string" && typeof d.claimedBy === "string";
}

/** Load raw JSON objects from a JSONL file, skipping malformed lines. */
async function loadJsonlRaw(path: string): Promise<unknown[]> {
  if (!existsSync(path)) return [];

  try {
    const content = await readFile(path, "utf-8");
    const entries: unknown[] = [];

    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/** Persist a collaboration event to the appropriate JSONL file. */
async function persistEvent(event: CollaborationEvent): Promise<void> {
  if (!storeDir) return;

  try {
    if (event.type === "decision") {
      const line = JSON.stringify(event.data) + "\n";
      await appendFile(join(storeDir, "decisions.jsonl"), line, "utf-8");
    } else if (event.type === "claim") {
      // Store the full claim event (action + data) so we can replay unclaims
      const entry: ClaimEvent = {
        action: event.action,
        data: event.data,
        timestamp: event.timestamp,
      };
      const line = JSON.stringify(entry) + "\n";
      await appendFile(join(storeDir, "claims.jsonl"), line, "utf-8");
    }
    // Presence events are NOT persisted (ephemeral)
  } catch {
    // Persistence errors are non-fatal — data remains in memory
  }
}

/**
 * Resolve the latest claim state per itemId from a series of claim events.
 * A "claim" followed by "unclaim" for the same itemId means the item is unclaimed.
 */
function resolveLatestClaims(events: ClaimEvent[]): ReviewClaim[] {
  const claimMap = new Map<string, ReviewClaim>();

  for (const event of events) {
    if (event.action === "claim") {
      claimMap.set(event.data.itemId, event.data);
    } else if (event.action === "unclaim") {
      claimMap.delete(event.data.itemId);
    }
  }

  return [...claimMap.values()];
}
