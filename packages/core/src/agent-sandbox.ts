/**
 * Agent sandbox — per-story permission boundaries (Story 47.2).
 *
 * Pure functions. Checks file access against allowed/denied glob patterns.
 * No external dependencies — simple glob-to-regex conversion.
 *
 * Supported glob features: * (single level), ** (any depth), ? (single char).
 * Not supported: brace expansion ({a,b}) — braces are treated as literals.
 */

import { resolve } from "node:path";

/** Sandbox configuration. */
export interface AgentSandboxConfig {
  /** Glob patterns for allowed paths. Empty = allow all. */
  allowedPaths: string[];
  /** Glob patterns for denied paths. Deny always overrides allow. */
  deniedPaths: string[];
}

/** Access check result. */
export interface AccessResult {
  allowed: boolean;
  reason: string;
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports ** (any depth), * (single level), and ? (single char).
 * Returns a never-matching regex if the pattern produces invalid regex.
 */
export function globToRegex(glob: string): RegExp {
  // Handle ? before escaping (so we can replace it with a wildcard)
  const withQuestionPlaceholder = glob.replace(/\?/g, "<<QUESTION>>");
  const escaped = withQuestionPlaceholder.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped
    .replace(/\*\*/g, "<<GLOBSTAR>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<GLOBSTAR>>/g, ".*")
    .replace(/<<QUESTION>>/g, "[^/]");
  try {
    return new RegExp(`^${withWildcards}$`);
  } catch {
    return /(?!)/; // Never-matching regex on invalid pattern
  }
}

/**
 * Normalize a file path to prevent traversal attacks.
 * Resolves .. and . segments.
 */
function normalizePath(filePath: string): string {
  // For relative paths, resolve against a virtual root to eliminate traversal
  if (!filePath.startsWith("/")) {
    // Resolve relative to / then strip leading /
    const resolved = resolve("/", filePath);
    return resolved.slice(1); // Remove leading /
  }
  return resolve(filePath);
}

/**
 * Check if a file path is allowed by the sandbox config.
 *
 * Priority:
 * 1. If deniedPaths matches → DENIED (always wins)
 * 2. If allowedPaths is empty → ALLOWED (no restrictions)
 * 3. If allowedPaths matches → ALLOWED
 * 4. If allowedPaths non-empty and no match → DENIED
 *
 * Path traversal (../) is normalized before checking.
 * Pure function — no I/O.
 */
export function checkAccess(filePath: string, config?: AgentSandboxConfig): AccessResult {
  // No config = allow all
  if (!config) {
    return { allowed: true, reason: "No sandbox configured" };
  }

  // Empty path = deny
  if (!filePath) {
    return { allowed: false, reason: "Empty file path" };
  }

  // Normalize path to prevent traversal attacks
  const normalized = normalizePath(filePath);

  // Check denied paths first (deny always wins) — filter empty patterns
  for (const pattern of config.deniedPaths.filter(Boolean)) {
    if (globToRegex(pattern).test(normalized)) {
      return { allowed: false, reason: `Denied by pattern: ${pattern}` };
    }
  }

  // No allowed paths (after filtering empties) = allow all (opt-in restriction)
  const allowedNonEmpty = config.allowedPaths.filter(Boolean);
  if (allowedNonEmpty.length === 0) {
    return { allowed: true, reason: "No path restrictions" };
  }

  // Check allowed paths
  for (const pattern of allowedNonEmpty) {
    if (globToRegex(pattern).test(normalized)) {
      return { allowed: true, reason: `Allowed by pattern: ${pattern}` };
    }
  }

  // Allowed paths defined but no match
  return { allowed: false, reason: "Path not in allowedPaths" };
}
