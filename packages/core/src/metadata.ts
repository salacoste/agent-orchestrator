/**
 * Flat-file metadata read/write.
 *
 * Architecture:
 * - Session metadata stored in project-specific directories
 * - Path: ~/.agent-orchestrator/{hash}-{projectId}/sessions/{sessionName}
 * - Session files use user-facing names (int-1) not tmux names (a3b4c5d6e7f8-int-1)
 * - Metadata includes tmuxName field to map user-facing → tmux name
 *
 * Format: key=value pairs (one per line), compatible with bash scripts
 *
 * Example file contents:
 *   project=integrator
 *   worktree=/Users/foo/.agent-orchestrator/a3b4c5d6e7f8-integrator/worktrees/int-1
 *   branch=feat/INT-1234
 *   status=working
 *   tmuxName=a3b4c5d6e7f8-int-1
 *   pr=https://github.com/org/repo/pull/42
 *   issue=INT-1234
 */

import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
  openSync,
  closeSync,
  constants,
} from "node:fs";
import { join, dirname } from "node:path";
import type { SessionId, SessionMetadata } from "./types.js";

/**
 * Parse a key=value metadata file into a record.
 * Lines starting with # are comments. Empty lines are skipped.
 * Only the first `=` is used as the delimiter (values can contain `=`).
 */
function parseMetadataFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/** Serialize a record back to key=value format. */
function serializeMetadata(data: Record<string, string>): string {
  return (
    Object.entries(data)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

/**
 * Atomically write a file by writing to a temp file then renaming.
 * rename() is atomic on POSIX, so concurrent writers never produce torn data.
 */
function atomicWriteFileSync(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}

/**
 * Create a backup copy of a metadata file before overwriting.
 * Non-fatal: backup failure does not block the write.
 */
function createBackup(filePath: string): void {
  if (!existsSync(filePath)) return;
  const backupPath = `${filePath}.backup`;
  try {
    copyFileSync(filePath, backupPath);
  } catch {
    // Backup failure is non-fatal — continue with write
  }
}

/**
 * Detect corruption: a non-empty file that parses to zero keys is corrupted.
 */
function isCorrupted(content: string, parsed: Record<string, string>): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false; // Empty file is not corruption, just missing data
  return Object.keys(parsed).length === 0;
}

/**
 * Attempt recovery from backup file.
 * Returns the recovered content string, or null if recovery fails.
 */
function recoverFromBackup(filePath: string): string | null {
  const backupPath = `${filePath}.backup`;
  if (!existsSync(backupPath)) return null;
  try {
    const backupContent = readFileSync(backupPath, "utf-8");
    const backupParsed = parseMetadataFile(backupContent);
    if (Object.keys(backupParsed).length === 0) return null; // Backup also corrupt
    // Restore primary from backup
    writeFileSync(filePath, backupContent, "utf-8");
    return backupContent;
  } catch {
    return null;
  }
}

/** Validate sessionId to prevent path traversal. */
const VALID_SESSION_ID = /^[a-zA-Z0-9_-]+$/;

function validateSessionId(sessionId: SessionId): void {
  if (!VALID_SESSION_ID.test(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
}

/** Get the metadata file path for a session. */
function metadataPath(dataDir: string, sessionId: SessionId): string {
  validateSessionId(sessionId);
  return join(dataDir, sessionId);
}

/** Build a SessionMetadata from a raw parsed record */
function buildSessionMetadata(raw: Record<string, string>): SessionMetadata {
  return {
    worktree: raw["worktree"] ?? "",
    branch: raw["branch"] ?? "",
    status: raw["status"] ?? "unknown",
    tmuxName: raw["tmuxName"],
    issue: raw["issue"],
    pr: raw["pr"],
    summary: raw["summary"],
    project: raw["project"],
    agent: raw["agent"],
    createdAt: raw["createdAt"],
    runtimeHandle: raw["runtimeHandle"],
    restoredAt: raw["restoredAt"],
    role: raw["role"],
    dashboardPort: raw["dashboardPort"] ? Number(raw["dashboardPort"]) : undefined,
    terminalWsPort: raw["terminalWsPort"] ? Number(raw["terminalWsPort"]) : undefined,
    directTerminalWsPort: raw["directTerminalWsPort"]
      ? Number(raw["directTerminalWsPort"])
      : undefined,
    // Agent failure/crash details for resume functionality
    exitCode: raw["exitCode"] ? Number(raw["exitCode"]) : undefined,
    signal: raw["signal"],
    failureReason: raw["failureReason"],
    previousLogsPath: raw["previousLogsPath"],
  };
}

/**
 * Read metadata for a session. Returns null if the file doesn't exist.
 * Detects corruption and attempts recovery from backup.
 */
export type { SessionId };
export function readMetadata(
  dataDir: string,
  sessionId: SessionId,
  onCorruptionDetected?: (filePath: string, recovered: boolean) => void,
): SessionMetadata | null {
  const path = metadataPath(dataDir, sessionId);
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  const raw = parseMetadataFile(content);

  // Corruption detection: non-empty file with zero parsed keys
  if (isCorrupted(content, raw)) {
    // eslint-disable-next-line no-console -- Corruption is a critical event worth logging
    console.warn(`Metadata file corrupted: ${path}`);

    const recovered = recoverFromBackup(path);
    if (recovered) {
      // eslint-disable-next-line no-console -- Recovery success should be visible
      console.log(`Metadata restored from backup: ${path}`);
      onCorruptionDetected?.(path, true);
      return buildSessionMetadata(parseMetadataFile(recovered));
    }

    // Both primary and backup corrupt — return null (existing behavior)
    // eslint-disable-next-line no-console -- Both-corrupt fallback should be visible
    console.warn(`Metadata backup also corrupt or missing: ${path}`);
    onCorruptionDetected?.(path, false);
    return null;
  }

  return buildSessionMetadata(raw);
}

/**
 * Read raw metadata as a string record (for arbitrary keys).
 */
export function readMetadataRaw(
  dataDir: string,
  sessionId: SessionId,
): Record<string, string> | null {
  const path = metadataPath(dataDir, sessionId);
  if (!existsSync(path)) return null;
  return parseMetadataFile(readFileSync(path, "utf-8"));
}

/**
 * Write full metadata for a session (overwrites existing file).
 * Creates a backup of the existing file before writing.
 */
export function writeMetadata(
  dataDir: string,
  sessionId: SessionId,
  metadata: SessionMetadata,
): void {
  const path = metadataPath(dataDir, sessionId);
  mkdirSync(dirname(path), { recursive: true });

  // Backup current file before overwriting
  createBackup(path);

  const data: Record<string, string> = {
    worktree: metadata.worktree,
    branch: metadata.branch,
    status: metadata.status,
  };

  if (metadata.tmuxName) data["tmuxName"] = metadata.tmuxName;
  if (metadata.issue) data["issue"] = metadata.issue;
  if (metadata.pr) data["pr"] = metadata.pr;
  if (metadata.summary) data["summary"] = metadata.summary;
  if (metadata.project) data["project"] = metadata.project;
  if (metadata.agent) data["agent"] = metadata.agent;
  if (metadata.createdAt) data["createdAt"] = metadata.createdAt;
  if (metadata.runtimeHandle) data["runtimeHandle"] = metadata.runtimeHandle;
  if (metadata.restoredAt) data["restoredAt"] = metadata.restoredAt;
  if (metadata.role) data["role"] = metadata.role;
  if (metadata.dashboardPort !== undefined) data["dashboardPort"] = String(metadata.dashboardPort);
  if (metadata.terminalWsPort !== undefined)
    data["terminalWsPort"] = String(metadata.terminalWsPort);
  if (metadata.directTerminalWsPort !== undefined)
    data["directTerminalWsPort"] = String(metadata.directTerminalWsPort);
  // Agent failure/crash details for resume functionality
  if (metadata.exitCode !== undefined) data["exitCode"] = String(metadata.exitCode);
  if (metadata.signal) data["signal"] = metadata.signal;
  if (metadata.failureReason) data["failureReason"] = metadata.failureReason;
  if (metadata.previousLogsPath) data["previousLogsPath"] = metadata.previousLogsPath;

  atomicWriteFileSync(path, serializeMetadata(data));
}

/**
 * Update specific fields in a session's metadata.
 * Reads existing file, merges updates, writes back.
 * Creates a backup before writing.
 */
export function updateMetadata(
  dataDir: string,
  sessionId: SessionId,
  updates: Partial<Record<string, string>>,
): void {
  const path = metadataPath(dataDir, sessionId);
  let existing: Record<string, string> = {};

  if (existsSync(path)) {
    existing = parseMetadataFile(readFileSync(path, "utf-8"));
  }

  // Merge updates — remove keys set to empty string
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (value === "") {
      const { [key]: _, ...rest } = existing;
      existing = rest;
    } else {
      existing[key] = value;
    }
  }

  mkdirSync(dirname(path), { recursive: true });

  // Backup current file before overwriting
  createBackup(path);

  atomicWriteFileSync(path, serializeMetadata(existing));
}

/**
 * Delete a session's metadata file.
 * Optionally archive it to an `archive/` subdirectory.
 */
export function deleteMetadata(dataDir: string, sessionId: SessionId, archive = true): void {
  const path = metadataPath(dataDir, sessionId);
  if (!existsSync(path)) return;

  if (archive) {
    const archiveDir = join(dataDir, "archive");
    mkdirSync(archiveDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivePath = join(archiveDir, `${sessionId}_${timestamp}`);
    writeFileSync(archivePath, readFileSync(path, "utf-8"));
  }

  unlinkSync(path);
}

/**
 * Read the latest archived metadata for a session.
 * Archive files are named `<sessionId>_<ISO-timestamp>` inside `<dataDir>/archive/`.
 * Returns null if no archived metadata exists.
 */
export function readArchivedMetadataRaw(
  dataDir: string,
  sessionId: SessionId,
): Record<string, string> | null {
  validateSessionId(sessionId);
  const archiveDir = join(dataDir, "archive");
  if (!existsSync(archiveDir)) return null;

  const prefix = `${sessionId}_`;
  let latest: string | null = null;

  for (const file of readdirSync(archiveDir)) {
    if (!file.startsWith(prefix)) continue;
    // Verify the separator is followed by a digit (start of ISO timestamp)
    // to avoid prefix collisions (e.g., "app" matching "app_v2_...")
    const charAfterPrefix = file[prefix.length];
    if (!charAfterPrefix || charAfterPrefix < "0" || charAfterPrefix > "9") continue;
    // Pick lexicographically last (ISO timestamps sort correctly)
    if (!latest || file > latest) {
      latest = file;
    }
  }

  if (!latest) return null;
  try {
    return parseMetadataFile(readFileSync(join(archiveDir, latest), "utf-8"));
  } catch {
    return null;
  }
}

/**
 * List all session IDs that have metadata files.
 */
export function listMetadata(dataDir: string): SessionId[] {
  const dir = dataDir;
  if (!existsSync(dir)) return [];

  return readdirSync(dir).filter((name) => {
    if (name === "archive" || name.startsWith(".")) return false;
    if (!VALID_SESSION_ID.test(name)) return false;
    try {
      return statSync(join(dir, name)).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Atomically reserve a session ID by creating its metadata file with O_EXCL.
 * Returns true if the ID was successfully reserved, false if it already exists.
 */
export function reserveSessionId(dataDir: string, sessionId: SessionId): boolean {
  const path = metadataPath(dataDir, sessionId);
  mkdirSync(dirname(path), { recursive: true });
  try {
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

// Re-export getSessionsDir for convenience (it's defined in paths.ts)
export { getSessionsDir } from "./paths.js";
