/**
 * YAML Three-Way Merge Utility
 *
 * Implements three-way merge strategy for YAML objects.
 * Detects conflicts at field level and provides automatic merging
 * for non-conflicting changes.
 */

/**
 * Represents a conflict at a specific path in the YAML structure
 */
export interface MergeConflict {
  /** Dot-notation path to the conflicting field (e.g., "stories.story-001.status") */
  path: string;
  /** Value from the base/common ancestor */
  base: unknown;
  /** Value from our version (local changes) */
  ours: unknown;
  /** Value from their version (external changes) */
  theirs: unknown;
}

/**
 * Result of a three-way merge operation
 */
export interface MergeResult {
  /** Whether the merge completed without conflicts */
  success: boolean;
  /** The merged object if successful */
  merged?: unknown;
  /** List of conflicts if merge failed */
  conflicts?: MergeConflict[];
  /** Number of fields automatically merged */
  autoMergedCount: number;
  /** Number of conflicts detected */
  conflictCount: number;
}

/**
 * Resolution choice for a conflict
 */
export type ConflictResolution = "ours" | "theirs" | "base" | "manual";

/**
 * Manual resolution with a specific value
 */
export interface ManualResolution {
  resolution: "manual";
  value: unknown;
}

/**
 * A single conflict resolution decision
 */
export type ConflictChoice = ConflictResolution | ManualResolution;

/**
 * Map of conflict paths to their resolutions
 */
export type ConflictResolutions = Map<string, ConflictChoice>;

/**
 * Options for merge behavior
 */
export interface MergeOptions {
  /** Maximum depth to traverse for deep merging (default: 10) */
  maxDepth?: number;
  /** Whether to merge arrays or replace them (default: replace) */
  mergeArrays?: boolean;
  /** Custom conflict resolution function */
  onConflict?: (conflict: MergeConflict) => ConflictChoice | Promise<ConflictChoice>;
}

/**
 * History entry for tracking merges
 */
export interface MergeHistoryEntry {
  /** Timestamp of the merge */
  timestamp: string;
  /** Number of conflicts detected */
  conflictCount: number;
  /** Number of fields auto-merged */
  autoMergedCount: number;
  /** Whether the merge was successful */
  success: boolean;
  /** Resolutions applied (if any) */
  resolutions?: Record<string, ConflictChoice>;
}

/**
 * Three-way merge utility for YAML objects
 */
export class YamlMerger {
  private mergeHistory: MergeHistoryEntry[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Perform a three-way merge on YAML objects
   *
   * @param base - Common ancestor (previous state)
   * @param ours - Our changes (local state)
   * @param theirs - Their changes (external state)
   * @param options - Merge options
   * @returns Merge result with merged object or conflicts
   */
  async threeWayMerge(
    base: unknown,
    ours: unknown,
    theirs: unknown,
    options: MergeOptions = {},
  ): Promise<MergeResult> {
    const conflicts: MergeConflict[] = [];
    const maxDepth = options.maxDepth ?? 10;

    const merged = await this.mergeObjects(base, ours, theirs, "", conflicts, maxDepth, 0, options);

    const result: MergeResult = {
      success: conflicts.length === 0,
      autoMergedCount: 0,
      conflictCount: conflicts.length,
    };

    if (conflicts.length === 0) {
      result.merged = merged;
      result.autoMergedCount = this.countChangedFields(base, merged);
    } else {
      result.conflicts = conflicts;
    }

    // Record in history
    this.recordMerge(result);

    return result;
  }

  /**
   * Resolve conflicts interactively
   *
   * @param base - Common ancestor
   * @param ours - Our changes
   * @param theirs - Their changes
   * @param conflicts - List of detected conflicts
   * @param resolutions - Map of path to resolution choice
   * @returns Merged object after applying resolutions
   */
  async resolveConflicts(
    base: unknown,
    ours: unknown,
    theirs: unknown,
    conflicts: MergeConflict[],
    resolutions: ConflictResolutions,
  ): Promise<unknown> {
    const merged = this.deepClone(base);

    for (const conflict of conflicts) {
      const resolution = resolutions.get(conflict.path);

      if (!resolution) {
        // Default to keeping current value
        continue;
      }

      let resolvedValue: unknown;

      if (typeof resolution === "object" && "resolution" in resolution) {
        resolvedValue = resolution.value;
      } else {
        switch (resolution) {
          case "ours":
            resolvedValue = conflict.ours;
            break;
          case "theirs":
            resolvedValue = conflict.theirs;
            break;
          case "base":
            resolvedValue = conflict.base;
            break;
          default:
            resolvedValue = conflict.ours;
        }
      }

      this.setValueAtPath(merged, conflict.path, resolvedValue);
    }

    // Also merge non-conflicting changes from ours and theirs
    return this.mergeNonConflicting(base, ours, theirs, conflicts, merged);
  }

  /**
   * Generate conflict markers in git-style format
   *
   * @param conflict - The conflict to format
   * @returns Formatted conflict marker string
   */
  formatConflictMarkers(conflict: MergeConflict): string {
    const oursStr = this.formatValue(conflict.ours);
    const theirsStr = this.formatValue(conflict.theirs);
    const baseStr = this.formatValue(conflict.base);

    return `<<<<<<< ours
${oursStr}
=======
${theirsStr}
>>>>>>> theirs

||||||| base
${baseStr}
=======`;
  }

  /**
   * Get merge history for analytics
   */
  getHistory(): MergeHistoryEntry[] {
    return [...this.mergeHistory];
  }

  /**
   * Clear merge history
   */
  clearHistory(): void {
    this.mergeHistory = [];
  }

  // Private implementation methods

  private async mergeObjects(
    base: unknown,
    ours: unknown,
    theirs: unknown,
    path: string,
    conflicts: MergeConflict[],
    maxDepth: number,
    currentDepth: number,
    options: MergeOptions,
  ): Promise<unknown> {
    // Handle null/undefined
    if (base === null || base === undefined) {
      if (ours === null || ours === undefined) return theirs;
      if (theirs === null || theirs === undefined) return ours;
      if (this.deepEqual(ours, theirs)) return ours;

      conflicts.push({
        path: path || "root",
        base,
        ours,
        theirs,
      });
      return ours; // Default to ours on conflict
    }

    // Handle non-object types
    if (typeof base !== "object" || currentDepth >= maxDepth) {
      return this.mergePrimitives(base, ours, theirs, path, conflicts, options);
    }

    // Handle arrays
    if (Array.isArray(base)) {
      return await this.mergeArrays(base, ours, theirs, path, conflicts, options);
    }

    // Handle objects
    const baseObj = base as Record<string, unknown>;
    const oursObj = (ours as Record<string, unknown>) ?? {};
    const theirsObj = (theirs as Record<string, unknown>) ?? {};

    const merged: Record<string, unknown> = {};
    const allKeys = new Set([
      ...Object.keys(baseObj),
      ...Object.keys(oursObj),
      ...Object.keys(theirsObj),
    ]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      const baseValue = baseObj[key];
      const oursValue = oursObj[key];
      const theirsValue = theirsObj[key];

      // Check if key was deleted (not present, not just undefined value)
      const oursDeleted = !(key in oursObj);
      const theirsDeleted = !(key in theirsObj);

      // Check if only one side modified this key
      const oursModified = !this.deepEqual(baseValue, oursValue);
      const theirsModified = !this.deepEqual(baseValue, theirsValue);

      if (oursModified && !theirsModified) {
        // Only we modified - take our value (or deletion)
        if (!oursDeleted) {
          merged[key] = oursValue;
        }
        // If ours deleted, don't include the key
      } else if (!oursModified && theirsModified) {
        // Only they modified - take their value (or deletion)
        if (!theirsDeleted) {
          merged[key] = theirsValue;
        }
        // If theirs deleted, don't include the key
      } else if (oursModified && theirsModified) {
        // Both modified - check if same change
        if (oursDeleted && theirsDeleted) {
          // Both deleted - don't include
        } else if (this.deepEqual(oursValue, theirsValue) && oursDeleted === theirsDeleted) {
          // Same change (including deletion status)
          if (!oursDeleted) {
            merged[key] = oursValue;
          }
        } else {
          // Both modified differently - recurse or record conflict
          if (
            typeof baseValue === "object" &&
            baseValue !== null &&
            !Array.isArray(baseValue) &&
            currentDepth < maxDepth
          ) {
            merged[key] = await this.mergeObjects(
              baseValue,
              oursValue,
              theirsValue,
              childPath,
              conflicts,
              maxDepth,
              currentDepth + 1,
              options,
            );
          } else {
            conflicts.push({
              path: childPath,
              base: baseValue,
              ours: oursDeleted ? undefined : oursValue,
              theirs: theirsDeleted ? undefined : theirsValue,
            });
            merged[key] = oursDeleted ? baseValue : oursValue; // Default to ours if not deleted
          }
        }
      } else {
        // Neither modified - keep base
        merged[key] = baseValue;
      }
    }

    return merged;
  }

  private async mergePrimitives(
    base: unknown,
    ours: unknown,
    theirs: unknown,
    path: string,
    conflicts: MergeConflict[],
    options: MergeOptions,
  ): Promise<unknown> {
    if (this.deepEqual(ours, theirs)) {
      return ours;
    }

    const oursModified = !this.deepEqual(base, ours);
    const theirsModified = !this.deepEqual(base, theirs);

    if (oursModified && theirsModified) {
      const conflict: MergeConflict = {
        path,
        base,
        ours,
        theirs,
      };

      // Use onConflict callback if provided
      if (options.onConflict) {
        const resolution = await options.onConflict(conflict);
        conflicts.push(conflict);
        return resolution === "ours"
          ? ours
          : resolution === "theirs"
            ? theirs
            : resolution === "base"
              ? base
              : ours;
      }

      conflicts.push(conflict);
    }

    return oursModified ? ours : theirs;
  }

  private async mergeArrays(
    base: unknown[],
    ours: unknown,
    theirs: unknown,
    path: string,
    conflicts: MergeConflict[],
    options: MergeOptions,
  ): Promise<unknown[]> {
    const oursArr = Array.isArray(ours) ? ours : base;
    const theirsArr = Array.isArray(theirs) ? theirs : base;

    if (this.deepEqual(oursArr, theirsArr)) {
      return oursArr;
    }

    const oursModified = !this.deepEqual(base, oursArr);
    const theirsModified = !this.deepEqual(base, theirsArr);

    // If mergeArrays option is true, attempt element-wise merge
    if (options.mergeArrays) {
      return this.mergeArrayElements(base, oursArr, theirsArr, path, conflicts, options);
    }

    // Default: Simple strategy - if one side didn't change, use the changed side
    // If both changed differently, record conflict and use ours
    if (oursModified && theirsModified) {
      conflicts.push({
        path,
        base,
        ours: oursArr,
        theirs: theirsArr,
      });
    }

    return oursModified ? oursArr : theirsArr;
  }

  /**
   * Merge arrays element by element when mergeArrays option is true
   */
  private async mergeArrayElements(
    base: unknown[],
    ours: unknown[],
    theirs: unknown[],
    path: string,
    conflicts: MergeConflict[],
    options: MergeOptions,
  ): Promise<unknown[]> {
    const maxLength = Math.max(base.length, ours.length, theirs.length);
    const merged: unknown[] = [];

    for (let i = 0; i < maxLength; i++) {
      const basePath = `${path}[${i}]`;
      const baseElement = base[i];
      const oursElement = ours[i];
      const theirsElement = theirs[i];

      // If only one array has this index
      if (i >= base.length) {
        if (i < ours.length && i >= theirs.length) {
          merged.push(oursElement);
        } else if (i >= ours.length && i < theirs.length) {
          merged.push(theirsElement);
        } else if (i < ours.length && i < theirs.length) {
          // Both added at same index - check if same
          if (this.deepEqual(oursElement, theirsElement)) {
            merged.push(oursElement);
          } else {
            conflicts.push({
              path: basePath,
              base: undefined,
              ours: oursElement,
              theirs: theirsElement,
            });
            merged.push(oursElement); // Default to ours
          }
        }
        continue;
      }

      // Both arrays have this index - merge elements
      if (typeof baseElement === "object" && baseElement !== null) {
        // Recursively merge objects
        merged.push(
          await this.mergeObjects(
            baseElement,
            oursElement,
            theirsElement,
            basePath,
            conflicts,
            options.maxDepth ?? 10,
            0,
            options,
          ),
        );
      } else {
        // Primitive merge
        merged.push(
          await this.mergePrimitives(
            baseElement,
            oursElement,
            theirsElement,
            basePath,
            conflicts,
            options,
          ),
        );
      }
    }

    return merged;
  }

  private mergeNonConflicting(
    base: unknown,
    ours: unknown,
    theirs: unknown,
    conflicts: MergeConflict[],
    merged: unknown,
  ): unknown {
    const conflictPaths = new Set(conflicts.map((c) => c.path));

    // Apply non-conflicting changes from ours
    this.applyNonConflictingChanges(base, ours, merged, conflictPaths, "");

    // Apply non-conflicting changes from theirs
    this.applyNonConflictingChanges(base, theirs, merged, conflictPaths, "");

    return merged;
  }

  private applyNonConflictingChanges(
    base: unknown,
    source: unknown,
    target: unknown,
    conflictPaths: Set<string>,
    currentPath: string,
  ): void {
    if (
      typeof base !== "object" ||
      base === null ||
      typeof source !== "object" ||
      source === null ||
      typeof target !== "object" ||
      target === null
    ) {
      return;
    }

    const baseObj = base as Record<string, unknown>;
    const sourceObj = source as Record<string, unknown>;
    const targetObj = target as Record<string, unknown>;

    for (const [key, sourceValue] of Object.entries(sourceObj)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;

      if (conflictPaths.has(childPath)) {
        continue; // Skip conflicting paths
      }

      const baseValue = baseObj[key];

      if (!this.deepEqual(baseValue, sourceValue)) {
        // This was modified in source - apply to target
        targetObj[key] = sourceValue;
      }
    }
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    // Fast path for identical references
    if (a === b) return true;

    // Handle null/undefined
    if (a === null || a === undefined) return b === null || b === undefined;
    if (b === null || b === undefined) return false;

    // Handle different types
    if (typeof a !== typeof b) return false;

    // Handle NaN
    if (typeof a === "number" && typeof b === "number") {
      if (Number.isNaN(a) && Number.isNaN(b)) return true;
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
    }

    // Handle special objects that JSON.stringify doesn't handle well
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !this.deepEqual(value, b.get(key))) return false;
      }
      return true;
    }
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      const arrA = [...a];
      const arrB = [...b];
      return this.deepEqual(arrA.sort(), arrB.sort());
    }

    // For plain objects and arrays, use JSON comparison
    // (Note: property order doesn't matter for equality in our use case)
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      // Circular reference or other issue
      return false;
    }
  }

  private deepClone<T>(value: T): T {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== "object") {
      return value;
    }

    // Handle Date
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    // Handle Map
    if (value instanceof Map) {
      const cloned = new Map();
      for (const [key, val] of value) {
        cloned.set(key, this.deepClone(val));
      }
      return cloned as T;
    }

    // Handle Set
    if (value instanceof Set) {
      const cloned = new Set();
      for (const val of value) {
        cloned.add(this.deepClone(val));
      }
      return cloned as T;
    }

    // Handle Array
    if (Array.isArray(value)) {
      return value.map((item) => this.deepClone(item)) as T;
    }

    // Handle plain objects
    const cloned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = this.deepClone(val);
    }
    return cloned as T;
  }

  private setValueAtPath(obj: unknown, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private formatValue(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }

  private countChangedFields(base: unknown, merged: unknown): number {
    if (typeof base !== "object" || base === null) return 0;
    if (typeof merged !== "object" || merged === null) return 0;

    let count = 0;
    const baseObj = base as Record<string, unknown>;
    const mergedObj = merged as Record<string, unknown>;

    for (const key of Object.keys(mergedObj)) {
      if (!this.deepEqual(baseObj[key], mergedObj[key])) {
        count++;
      }
    }

    return count;
  }

  private recordMerge(result: MergeResult): void {
    this.mergeHistory.push({
      timestamp: new Date().toISOString(),
      conflictCount: result.conflictCount,
      autoMergedCount: result.autoMergedCount,
      success: result.success,
    });

    // Trim history if too large
    if (this.mergeHistory.length > this.maxHistorySize) {
      this.mergeHistory = this.mergeHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance for convenience
export const yamlMerger = new YamlMerger();

/**
 * Quick merge function for simple use cases
 */
export async function threeWayMerge(
  base: unknown,
  ours: unknown,
  theirs: unknown,
  options?: MergeOptions,
): Promise<MergeResult> {
  return yamlMerger.threeWayMerge(base, ours, theirs, options);
}
