import { describe, it, expect } from "vitest";
import {
  createVersionCompatibilityMatrix,
  compareVersions,
  isValidSemver,
  type PluginCompatibilityEntry,
} from "../plugin-version-compatibility.js";

describe("Version Compatibility Matrix", () => {
  describe("compareVersions", () => {
    it("should compare major versions", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it("should compare minor versions", () => {
      expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
      expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
      expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    });

    it("should compare patch versions", () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(compareVersions("1.0.5", "1.0.5")).toBe(0);
    });

    it("should handle complex comparisons", () => {
      expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
      expect(compareVersions("2.1.0", "1.9.9")).toBe(1);
      expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    });
  });

  describe("isValidSemver", () => {
    it("should validate proper semver strings", () => {
      expect(isValidSemver("1.0.0")).toBe(true);
      expect(isValidSemver("0.0.1")).toBe(true);
      expect(isValidSemver("10.20.30")).toBe(true);
    });

    it("should reject invalid semver strings", () => {
      expect(isValidSemver("1.0")).toBe(false);
      expect(isValidSemver("v1.0.0")).toBe(false);
      expect(isValidSemver("")).toBe(false);
      expect(isValidSemver("latest")).toBe(false);
    });

    it("should accept pre-release versions as valid", () => {
      // Pre-release versions are technically valid semver
      expect(isValidSemver("1.0.0-alpha")).toBe(true);
      expect(isValidSemver("1.0.0-beta.1")).toBe(true);
    });
  });

  describe("VersionCompatibilityMatrix", () => {
    it("should check unknown plugins", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const result = matrix.check("unknown-plugin", "1.0.0");

      expect(result.status).toBe("unknown");
      expect(result.pluginName).toBe("unknown-plugin");
      expect(result.message).toContain("not in the compatibility registry");
    });

    it("should check built-in plugin compatibility", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const result = matrix.check("@composio/ao-plugin-runtime-tmux", "0.1.0");

      expect(result.status).toBe("compatible");
      expect(result.pluginVersion).toBe("0.1.0");
    });

    it("should detect incompatible (too old) versions", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const result = matrix.check("@composio/ao-plugin-runtime-tmux", "0.0.1");

      expect(result.status).toBe("incompatible");
      expect(result.minimumVersion).toBeDefined();
      expect(result.recommendation).toContain("Upgrade");
    });

    it("should warn on potentially incompatible (too new) versions", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const result = matrix.check("@composio/ao-plugin-runtime-tmux", "2.0.0");

      expect(result.status).toBe("warning");
      expect(result.message).toContain("may not be fully tested");
    });

    it("should register new plugins", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });

      const newPlugin: PluginCompatibilityEntry = {
        name: "my-custom-plugin",
        ranges: [{ min: "1.0.0", max: "2.0.0" }],
        recommendedVersion: "1.5.0",
      };

      matrix.register(newPlugin);

      const result = matrix.check("my-custom-plugin", "1.5.0");
      expect(result.status).toBe("compatible");
    });

    it("should get registered plugins", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const plugins = matrix.getRegisteredPlugins();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some((p) => p.name.includes("runtime-tmux"))).toBe(true);
    });

    it("should get recommended version", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const recommended = matrix.getRecommendedVersion("@composio/ao-plugin-runtime-tmux");

      expect(recommended).toBe("0.1.0");
    });

    it("should return undefined for unknown plugin recommended version", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const recommended = matrix.getRecommendedVersion("unknown-plugin");

      expect(recommended).toBeUndefined();
    });

    it("should detect deprecated versions", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });

      // Register a plugin with deprecated range
      matrix.register({
        name: "deprecated-plugin",
        ranges: [
          {
            min: "0.1.0",
            max: "0.2.0",
            deprecated: true,
            deprecationMessage: "Version 0.1.x is deprecated",
          },
          { min: "0.2.0", max: "1.0.0" },
        ],
        recommendedVersion: "0.2.0",
      });

      const result = matrix.check("deprecated-plugin", "0.1.5");
      expect(result.status).toBe("deprecated");
      expect(result.message).toContain("deprecated");

      const isDeprecated = matrix.isDeprecated("deprecated-plugin", "0.1.5");
      expect(isDeprecated).toBe(true);
    });

    it("should report non-deprecated versions correctly", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });
      const isDeprecated = matrix.isDeprecated("@composio/ao-plugin-runtime-tmux", "0.1.0");

      expect(isDeprecated).toBe(false);
    });

    it("should include known issues in result", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });

      matrix.register({
        name: "buggy-plugin",
        ranges: [
          {
            min: "1.0.0",
            max: "2.0.0",
            knownIssues: ["Issue #123: Crashes on startup", "Issue #124: Memory leak"],
          },
        ],
        recommendedVersion: "1.5.0",
      });

      const result = matrix.check("buggy-plugin", "1.5.0");
      expect(result.knownIssues).toBeDefined();
      expect(result.knownIssues).toHaveLength(2);
    });

    it("should recommend upgrading from compatible but not recommended version", () => {
      const matrix = createVersionCompatibilityMatrix({ coreVersion: "1.0.0" });

      // Register plugin with multiple compatible versions
      matrix.register({
        name: "multi-version-plugin",
        ranges: [{ min: "1.0.0", max: "2.0.0" }],
        recommendedVersion: "1.5.0",
        lastTestedVersion: "1.5.0",
      });

      const result = matrix.check("multi-version-plugin", "1.2.0");
      expect(result.status).toBe("compatible");
      expect(result.recommendation).toContain("recommended version");
    });
  });
});
