/**
 * Plugin Version Compatibility Matrix
 *
 * Tracks and validates plugin version compatibility with the orchestrator core.
 * Uses semantic versioning for compatibility checking.
 *
 * Features:
 * - Semantic version comparison
 * - Compatibility range checking
 * - Deprecated version warnings
 * - Known compatible version tracking
 */

/**
 * Plugin compatibility status
 */
export type CompatibilityStatus =
  | "compatible"
  | "warning"
  | "incompatible"
  | "deprecated"
  | "unknown";

/**
 * Plugin compatibility result
 */
export interface CompatibilityResult {
  /** Plugin name */
  pluginName: string;
  /** Plugin version */
  pluginVersion: string;
  /** Core version being checked against */
  coreVersion: string;
  /** Compatibility status */
  status: CompatibilityStatus;
  /** Human-readable message */
  message: string;
  /** Recommended action */
  recommendation?: string;
  /** Minimum compatible version (if incompatible) */
  minimumVersion?: string;
  /** Maximum compatible version (if deprecated) */
  maximumVersion?: string;
  /** Known issues with this version */
  knownIssues?: string[];
}

/**
 * Compatibility range definition
 */
export interface CompatibilityRange {
  /** Minimum version (inclusive) */
  min: string;
  /** Maximum version (exclusive) */
  max?: string;
  /** Whether this range is deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Known issues in this range */
  knownIssues?: string[];
}

/**
 * Plugin compatibility entry
 */
export interface PluginCompatibilityEntry {
  /** Plugin name */
  name: string;
  /** Supported compatibility ranges */
  ranges: CompatibilityRange[];
  /** Recommended version */
  recommendedVersion: string;
  /** Last tested version */
  lastTestedVersion?: string;
}

/**
 * Version compatibility matrix configuration
 */
export interface VersionCompatibilityConfig {
  /** Core version */
  coreVersion: string;
  /** Known plugin compatibility entries */
  knownPlugins?: Map<string, PluginCompatibilityEntry>;
}

/**
 * Version compatibility matrix service interface
 */
export interface VersionCompatibilityMatrix {
  /**
   * Check plugin version compatibility
   * @param pluginName - Plugin name
   * @param pluginVersion - Plugin version
   * @returns Compatibility result
   */
  check(pluginName: string, pluginVersion: string): CompatibilityResult;

  /**
   * Register a plugin's compatibility ranges
   * @param entry - Plugin compatibility entry
   */
  register(entry: PluginCompatibilityEntry): void;

  /**
   * Get all registered plugins
   */
  getRegisteredPlugins(): PluginCompatibilityEntry[];

  /**
   * Get recommended version for a plugin
   * @param pluginName - Plugin name
   */
  getRecommendedVersion(pluginName: string): string | undefined;

  /**
   * Check if version is deprecated
   * @param pluginName - Plugin name
   * @param version - Version to check
   */
  isDeprecated(pluginName: string, version: string): boolean;
}

/**
 * Parse semantic version string
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA || !parsedB) {
    // Fall back to string comparison
    return a.localeCompare(b);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }
  return 0;
}

/**
 * Check if version is in range [min, max)
 */
function isInRange(version: string, range: CompatibilityRange): boolean {
  if (compareVersions(version, range.min) < 0) {
    return false;
  }
  if (range.max && compareVersions(version, range.max) >= 0) {
    return false;
  }
  return true;
}

/**
 * Version Compatibility Matrix Implementation
 */
class VersionCompatibilityMatrixImpl implements VersionCompatibilityMatrix {
  private coreVersion: string;
  private knownPlugins: Map<string, PluginCompatibilityEntry>;

  constructor(config: VersionCompatibilityConfig) {
    this.coreVersion = config.coreVersion;
    this.knownPlugins = config.knownPlugins ?? new Map();

    // Initialize with known built-in plugins
    this.initializeBuiltinPlugins();
  }

  private initializeBuiltinPlugins(): void {
    // Register known built-in plugins with their compatibility ranges
    const builtinPlugins: PluginCompatibilityEntry[] = [
      {
        name: "@composio/ao-plugin-runtime-tmux",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-runtime-process",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-agent-claude-code",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-agent-glm",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-workspace-worktree",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-tracker-github",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
      {
        name: "@composio/ao-plugin-notifier-desktop",
        ranges: [{ min: "0.1.0", max: "1.0.0" }],
        recommendedVersion: "0.1.0",
        lastTestedVersion: "0.1.0",
      },
    ];

    for (const plugin of builtinPlugins) {
      if (!this.knownPlugins.has(plugin.name)) {
        this.knownPlugins.set(plugin.name, plugin);
      }
    }
  }

  check(pluginName: string, pluginVersion: string): CompatibilityResult {
    const entry = this.knownPlugins.get(pluginName);

    // Unknown plugin
    if (!entry) {
      return {
        pluginName,
        pluginVersion,
        coreVersion: this.coreVersion,
        status: "unknown",
        message: `Plugin '${pluginName}' is not in the compatibility registry. Use with caution.`,
        recommendation: "Verify plugin compatibility manually before use.",
      };
    }

    // Find matching range
    for (const range of entry.ranges) {
      if (isInRange(pluginVersion, range)) {
        // Check if deprecated
        if (range.deprecated) {
          return {
            pluginName,
            pluginVersion,
            coreVersion: this.coreVersion,
            status: "deprecated",
            message: range.deprecationMessage ?? `Version ${pluginVersion} is deprecated.`,
            recommendation: `Upgrade to version ${entry.recommendedVersion}`,
            maximumVersion: range.max,
            knownIssues: range.knownIssues,
          };
        }

        // Compatible version
        const isRecommended = pluginVersion === entry.recommendedVersion;
        const message = isRecommended
          ? `Plugin '${pluginName}' version ${pluginVersion} is fully compatible.`
          : `Plugin '${pluginName}' version ${pluginVersion} is compatible.`;

        const recommendation = isRecommended
          ? undefined
          : `Consider using recommended version ${entry.recommendedVersion}`;

        return {
          pluginName,
          pluginVersion,
          coreVersion: this.coreVersion,
          status: "compatible",
          message,
          recommendation,
          knownIssues: range.knownIssues,
        };
      }
    }

    // Version not in any known range
    const minVersion = entry.ranges[0]?.min;
    const maxVersion = entry.ranges[entry.ranges.length - 1]?.max;

    // Check if version is too old
    if (minVersion && compareVersions(pluginVersion, minVersion) < 0) {
      return {
        pluginName,
        pluginVersion,
        coreVersion: this.coreVersion,
        status: "incompatible",
        message: `Plugin version ${pluginVersion} is too old. Minimum required: ${minVersion}`,
        recommendation: `Upgrade to version ${entry.recommendedVersion} or later.`,
        minimumVersion: minVersion,
      };
    }

    // Check if version is too new
    if (maxVersion && compareVersions(pluginVersion, maxVersion) >= 0) {
      return {
        pluginName,
        pluginVersion,
        coreVersion: this.coreVersion,
        status: "warning",
        message: `Plugin version ${pluginVersion} may not be fully tested with this core version.`,
        recommendation: `Consider using version ${entry.recommendedVersion} or wait for core update.`,
        maximumVersion: maxVersion,
      };
    }

    // Unknown compatibility
    return {
      pluginName,
      pluginVersion,
      coreVersion: this.coreVersion,
      status: "unknown",
      message: `Unable to determine compatibility for version ${pluginVersion}.`,
      recommendation: `Recommended version: ${entry.recommendedVersion}`,
    };
  }

  register(entry: PluginCompatibilityEntry): void {
    this.knownPlugins.set(entry.name, entry);
  }

  getRegisteredPlugins(): PluginCompatibilityEntry[] {
    return Array.from(this.knownPlugins.values());
  }

  getRecommendedVersion(pluginName: string): string | undefined {
    const entry = this.knownPlugins.get(pluginName);
    return entry?.recommendedVersion;
  }

  isDeprecated(pluginName: string, version: string): boolean {
    const entry = this.knownPlugins.get(pluginName);
    if (!entry) return false;

    for (const range of entry.ranges) {
      if (isInRange(version, range) && range.deprecated) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Create a version compatibility matrix service
 */
export function createVersionCompatibilityMatrix(
  config: VersionCompatibilityConfig,
): VersionCompatibilityMatrix {
  return new VersionCompatibilityMatrixImpl(config);
}

/**
 * Helper function to validate semantic version format
 */
export function isValidSemver(version: string): boolean {
  return parseSemver(version) !== null;
}

/**
 * Helper function to compare versions
 */
export { compareVersions };
