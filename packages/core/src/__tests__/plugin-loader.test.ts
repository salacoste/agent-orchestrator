/**
 * Plugin Loader Tests
 *
 * Tests the plugin loading, validation, and permission system.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createPluginLoader } from "../plugin-loader.js";

describe("PluginLoader", () => {
  let testPluginsDir: string;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test plugins
    tempDir = `/tmp/plugin-loader-test-${Date.now()}`;
    testPluginsDir = join(tempDir, "plugins");
    await mkdir(testPluginsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("scan plugins directory", () => {
    it("should find plugin.yaml files in subdirectories", async () => {
      // Create test plugin structure
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("test-plugin");
    });

    it("should return empty array when no plugins found", async () => {
      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toEqual([]);
    });

    it("should ignore directories without plugin.yaml", async () => {
      // Create directory without plugin.yaml
      const emptyDir = join(testPluginsDir, "empty-plugin");
      await mkdir(emptyDir, { recursive: true });

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toEqual([]);
    });
  });

  describe("validate plugin manifests", () => {
    it("should validate required fields", async () => {
      const pluginDir = join(testPluginsDir, "incomplete-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: incomplete-plugin
# missing version, description, apiVersion, main
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("failed");
      expect(results[0]?.error).toContain("validation");
    });

    it("should check API version compatibility", async () => {
      const pluginDir = join(testPluginsDir, "incompatible-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: incompatible-plugin
version: 1.0.0
description: Incompatible plugin
apiVersion: 2.0.0
main: ./index.js
permissions: []
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("failed");
      expect(results[0]?.error).toContain("incompatible API version");
    });

    it("should accept plugins with compatible API version", async () => {
      const pluginDir = join(testPluginsDir, "compatible-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: compatible-plugin
version: 1.0.0
description: Compatible plugin
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("loaded");
    });
  });

  describe("permission system", () => {
    it("should load plugin permissions from manifest", async () => {
      const pluginDir = join(testPluginsDir, "plugin-with-perms");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: plugin-with-perms
version: 1.0.0
description: Plugin with permissions
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
  - tracker
  - notifier
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.permissions).toEqual(["runtime", "tracker", "notifier"]);
    });

    it("should check permissions before operation", async () => {
      const pluginDir = join(testPluginsDir, "restricted-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: restricted-plugin
version: 1.0.0
description: Restricted plugin
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      await loader.scan();

      // Should allow permitted operation
      expect(loader.checkPermission("restricted-plugin", "runtime")).toBe(true);

      // Should deny non-permitted operation
      expect(loader.checkPermission("restricted-plugin", "tracker")).toBe(false);
    });
  });

  describe("error handling and isolation", () => {
    it("should isolate plugin initialization errors", async () => {
      // Create one valid plugin and one invalid
      const validDir = join(testPluginsDir, "valid-plugin");
      await mkdir(validDir, { recursive: true });
      await writeFile(
        join(validDir, "plugin.yaml"),
        `
name: valid-plugin
version: 1.0.0
description: Valid plugin
apiVersion: 1.0.0
main: ./index.js
permissions: []
`,
      );

      const invalidDir = join(testPluginsDir, "invalid-plugin");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(
        join(invalidDir, "plugin.yaml"),
        `
invalid yaml content [[[
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const results = await loader.scan();

      // Should still load valid plugin
      const valid = results.find((r) => r.name === "valid-plugin");
      expect(valid?.status).toBe("loaded");

      // Invalid plugin should be marked as failed
      const invalid = results.find((r) => r.name === "invalid-plugin");
      expect(invalid?.status).toBe("failed");
      expect(invalid?.error).toBeTruthy();
    });
  });

  describe("hot reload", () => {
    it("should reload plugins and re-validate", async () => {
      const pluginDir = join(testPluginsDir, "reloadable-plugin");
      await mkdir(pluginDir, { recursive: true });
      const manifestPath = join(pluginDir, "plugin.yaml");

      await writeFile(
        manifestPath,
        `
name: reloadable-plugin
version: 1.0.0
description: Reloadable plugin
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
`,
      );

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      // Initial load
      let results = await loader.scan();
      expect(results).toHaveLength(1);
      expect(results[0]?.version).toBe("1.0.0");

      // Update plugin
      await writeFile(
        manifestPath,
        `
name: reloadable-plugin
version: 2.0.0
description: Updated plugin
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
  - tracker
`,
      );

      // Reload
      results = await loader.reload();

      expect(results).toHaveLength(1);
      expect(results[0]?.version).toBe("2.0.0");
      expect(results[0]?.permissions).toContain("tracker");
    });
  });

  describe("load performance", () => {
    it("should load plugins within 2 seconds", async () => {
      // Create multiple plugins
      for (let i = 0; i < 10; i++) {
        const pluginDir = join(testPluginsDir, `plugin-${i}`);
        await mkdir(pluginDir, { recursive: true });
        await writeFile(
          join(pluginDir, "plugin.yaml"),
          `
name: plugin-${i}
version: 1.0.0
description: Plugin ${i}
apiVersion: 1.0.0
main: ./index.js
permissions:
  - runtime
`,
        );
      }

      const loader = createPluginLoader({
        pluginsDir: testPluginsDir,
        apiVersion: "1.0.0",
      });

      const startTime = Date.now();
      await loader.scan();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });
});
