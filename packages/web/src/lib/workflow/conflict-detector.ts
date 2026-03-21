/**
 * File conflict detector (Story 20.1).
 *
 * Detects overlapping file modifications across agent worktrees
 * by comparing file lists from different sessions.
 * Pure module — no I/O, fully testable.
 */

/** A detected file conflict between two agents. */
export interface FileConflict {
  /** Relative file path that both agents modified. */
  filePath: string;
  /** Agent/session that modified the file first. */
  agentA: string;
  /** Agent/session that modified the file second. */
  agentB: string;
}

/** File modification record from an agent session. */
export interface AgentFileChange {
  /** Agent/session identifier. */
  agentId: string;
  /** Files modified by this agent (relative paths). */
  modifiedFiles: string[];
}

/**
 * Detect file conflicts across agent sessions.
 *
 * Compares file modification lists from multiple agents and identifies
 * files modified by more than one agent — potential merge conflicts.
 *
 * @param changes - File modification records from all active agents
 * @returns Array of file conflicts (may be empty)
 */
export function detectFileConflicts(changes: AgentFileChange[]): FileConflict[] {
  const conflicts: FileConflict[] = [];
  const fileToAgent = new Map<string, string>();

  for (const change of changes) {
    for (const file of change.modifiedFiles) {
      const existing = fileToAgent.get(file);
      if (existing && existing !== change.agentId) {
        conflicts.push({
          filePath: file,
          agentA: existing,
          agentB: change.agentId,
        });
      } else {
        fileToAgent.set(file, change.agentId);
      }
    }
  }

  return conflicts;
}

/**
 * Group conflicts by file path for display.
 */
export function groupConflictsByFile(conflicts: FileConflict[]): Map<string, FileConflict[]> {
  const grouped = new Map<string, FileConflict[]>();
  for (const conflict of conflicts) {
    const existing = grouped.get(conflict.filePath) ?? [];
    existing.push(conflict);
    grouped.set(conflict.filePath, existing);
  }
  return grouped;
}
