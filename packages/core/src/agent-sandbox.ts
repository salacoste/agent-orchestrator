/**
 * Agent sandbox — per-story permission boundaries (Story 47.2).
 *
 * Pure functions. Checks file access against allowed/denied glob patterns.
 * No external dependencies — simple glob-to-regex conversion.
 */

/** Sandbox configuration. */
export interface SandboxConfig {
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
 * Supports ** (any depth) and * (single level).
 */
export function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped
    .replace(/\*\*/g, "<<GLOBSTAR>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<GLOBSTAR>>/g, ".*");
  return new RegExp(`^${withWildcards}$`);
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
 * Pure function — no I/O.
 */
export function checkAccess(filePath: string, config?: SandboxConfig): AccessResult {
  // No config = allow all
  if (!config) {
    return { allowed: true, reason: "No sandbox configured" };
  }

  // Check denied paths first (deny always wins)
  for (const pattern of config.deniedPaths) {
    if (globToRegex(pattern).test(filePath)) {
      return { allowed: false, reason: `Denied by pattern: ${pattern}` };
    }
  }

  // No allowed paths = allow all (opt-in restriction)
  if (config.allowedPaths.length === 0) {
    return { allowed: true, reason: "No path restrictions" };
  }

  // Check allowed paths
  for (const pattern of config.allowedPaths) {
    if (globToRegex(pattern).test(filePath)) {
      return { allowed: true, reason: `Allowed by pattern: ${pattern}` };
    }
  }

  // Allowed paths defined but no match
  return { allowed: false, reason: "Path not in allowedPaths" };
}
