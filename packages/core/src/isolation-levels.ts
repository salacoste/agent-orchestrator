/**
 * Agent isolation levels — security sandboxing (Story 46b.4).
 *
 * Pure functions. Defines isolation policies per project.
 * Enforcement is handled by workspace/runtime plugins (future stories).
 */

/** Isolation level for a project. */
export type IsolationLevel = "shared" | "isolated" | "quarantined";

/** Isolation policy — what an agent can/cannot do. */
export interface IsolationPolicy {
  level: IsolationLevel;
  /** Agent gets its own worktree (not shared). */
  ownWorktree: boolean;
  /** Agent can git push. */
  gitPushAllowed: boolean;
  /** Agent has network access. */
  networkAccess: boolean;
  /** Agent can access other project worktrees. */
  crossProjectAccess: boolean;
}

/** Policy definitions per level. */
const POLICIES: Record<IsolationLevel, Omit<IsolationPolicy, "level">> = {
  shared: {
    ownWorktree: false,
    gitPushAllowed: true,
    networkAccess: true,
    crossProjectAccess: true,
  },
  isolated: {
    ownWorktree: true,
    gitPushAllowed: true,
    networkAccess: true,
    crossProjectAccess: false,
  },
  quarantined: {
    ownWorktree: true,
    gitPushAllowed: false,
    networkAccess: false,
    crossProjectAccess: false,
  },
};

/**
 * Resolve isolation policy for a project.
 * Returns the full policy with permissions based on the configured level.
 */
export function resolveIsolation(level?: IsolationLevel): IsolationPolicy {
  const resolved = level ?? "shared";
  return { level: resolved, ...POLICIES[resolved] };
}
