/**
 * Conflict Resolver Service
 *
 * Detects and resolves version conflicts using optimistic locking.
 * Provides three resolution strategies: overwrite, retry, and merge.
 */

import type {
  StateManager,
  StoryState,
  ConflictResolver,
  Conflict,
  FieldConflict,
  Resolution,
  ResolveResult,
  MergeSelections,
} from "./types.js";

/**
 * Internal implementation of ConflictResolver
 */
class ConflictResolverImpl implements ConflictResolver {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  detect(storyId: string, expectedVersion: string, updates: Partial<StoryState>): Conflict | null {
    const current = this.stateManager.get(storyId);
    if (!current) {
      return null;
    }

    if (current.version !== expectedVersion) {
      // Build conflict details
      const conflicts: FieldConflict[] = [];
      for (const [field, value] of Object.entries(updates)) {
        conflicts.push({
          field,
          currentValue: (current as unknown as Record<string, unknown>)[field],
          proposedValue: value,
        });
      }

      // Validate proposed state has required fields
      const proposed: StoryState = {
        ...current,
        ...updates,
      };

      return {
        storyId,
        expectedVersion,
        actualVersion: current.version,
        conflicts,
        current,
        proposed,
      };
    }

    return null;
  }

  async resolve(conflict: Conflict, resolution: Resolution): Promise<ResolveResult> {
    switch (resolution) {
      case "overwrite":
        return this.overwrite(conflict);
      case "retry":
        return this.retry(conflict);
      case "merge":
        return this.mergeInteractive(conflict);
      default:
        return {
          success: false,
          error: `Unknown resolution: ${resolution}`,
        };
    }
  }

  private async overwrite(conflict: Conflict): Promise<ResolveResult> {
    const result = await this.stateManager.set(
      conflict.storyId,
      conflict.proposed,
      conflict.actualVersion, // Use actual version to force overwrite
    );

    if (result.success) {
      return {
        success: true,
        newVersion: result.version,
      };
    }

    return {
      success: false,
      error: result.error,
    };
  }

  private async retry(conflict: Conflict): Promise<ResolveResult> {
    // Refresh state
    await this.stateManager.invalidate();
    const current = this.stateManager.get(conflict.storyId);

    if (!current) {
      return {
        success: false,
        error: `Story ${conflict.storyId} not found after refresh`,
      };
    }

    // Reapply proposed changes on top of current state
    // Build validated merged state
    const merged: StoryState = {
      ...current,
      ...conflict.proposed,
    };
    // Remove version from proposed to let system generate new one
    delete (merged as unknown as Record<string, unknown>).version;

    const result = await this.stateManager.set(conflict.storyId, merged, current.version);

    if (result.success) {
      return {
        success: true,
        newVersion: result.version,
      };
    }

    return {
      success: false,
      error: result.error,
    };
  }

  async mergeInteractive(conflict: Conflict, selections?: MergeSelections): Promise<ResolveResult> {
    // If selections provided, use them directly (from CLI interactive prompts)
    // Otherwise, default to keeping current values
    const finalSelections: MergeSelections = selections || {};

    if (!selections) {
      // Default: keep current values for all fields when called without selections
      for (const fieldConflict of conflict.conflicts) {
        finalSelections[fieldConflict.field] = "current";
      }
    }

    const merged = this.merge(conflict.current, conflict.proposed, finalSelections);
    const result = await this.stateManager.set(conflict.storyId, merged, conflict.actualVersion);

    if (result.success) {
      return {
        success: true,
        newVersion: result.version,
      };
    }

    return {
      success: false,
      error: result.error,
    };
  }

  merge(current: StoryState, proposed: StoryState, selections: MergeSelections): StoryState {
    const merged: StoryState = { ...current };

    for (const [field, selection] of Object.entries(selections)) {
      if (selection === "proposed") {
        (merged as unknown as Record<string, unknown>)[field] = (
          proposed as unknown as Record<string, unknown>
        )[field];
      } else if (selection === "current") {
        // Keep current value (already set via spread)
        // Explicitly keeping this field unchanged
      }
    }

    return merged;
  }
}

/**
 * Factory function to create a ConflictResolver instance
 * @param stateManager - StateManager instance for state operations
 * @returns ConflictResolver instance
 */
export function createConflictResolver(stateManager: StateManager): ConflictResolver {
  return new ConflictResolverImpl(stateManager);
}

// Re-export ConflictError for convenience
export { ConflictError } from "./types.js";
