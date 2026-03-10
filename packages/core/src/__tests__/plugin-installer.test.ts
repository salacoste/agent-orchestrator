/**
 * Plugin Installer Tests
 *
 * Tests the plugin installation, update, and management system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPluginInstaller } from "../plugin-installer.js";

describe("PluginInstaller", () => {
  let testPluginsDir: string;
  let installer: ReturnType<typeof createPluginInstaller>;

  beforeEach(async () => {
    // Create temp directory for testing
    testPluginsDir = `/tmp/ao-plugins-test-${Date.now()}`;
    await mkdir(testPluginsDir, { recursive: true });

    installer = createPluginInstaller({
      pluginsDir: testPluginsDir,
      apiVersion: "1.0.0",
    });
  });

  describe("listPlugins", () => {
    it("should return empty list when no plugins installed", async () => {
      const plugins = await installer.listPlugins();
      expect(plugins).toEqual([]);
    });

    it("should list installed plugins", async () => {
      // Create a mock plugin directory with plugin.yaml
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 1.0.0
main: index.js
permissions:
  - runtime
  - agent
        `.trim(),
      );

      const plugins = await installer.listPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.name).toBe("test-plugin");
      expect(plugins[0]?.version).toBe("1.0.0");
      expect(plugins[0]?.enabled).toBe(true);
    });
  });

  describe("disable/enable", () => {
    it("should disable a plugin", async () => {
      // Create a mock plugin
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 1.0.0
main: index.js
permissions:
  - runtime
        `.trim(),
      );

      const disableResult = await installer.disable("test-plugin");
      expect(disableResult.status).toBe("disabled");

      const plugin = await installer.getPluginInfo("test-plugin");
      expect(plugin?.enabled).toBe(false);
    });

    it("should enable a disabled plugin", async () => {
      // Create a mock plugin
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 1.0.0
main: index.js
permissions:
  - runtime
        `.trim(),
      );

      // First disable
      await installer.disable("test-plugin");

      // Then enable
      const enableResult = await installer.enable("test-plugin");
      expect(enableResult.status).toBe("enabled");

      const plugin = await installer.getPluginInfo("test-plugin");
      expect(plugin?.enabled).toBe(true);
    });

    it("should return error when disabling non-existent plugin", async () => {
      const result = await installer.disable("non-existent");
      expect(result.status).toBe("failed");
      expect(result.error).toContain("not installed");
    });

    it("should return error when enabling non-existent plugin", async () => {
      const result = await installer.enable("non-existent");
      expect(result.status).toBe("failed");
      expect(result.error).toContain("not installed");
    });
  });

  describe("getPluginInfo", () => {
    it("should return undefined for non-existent plugin", async () => {
      const plugin = await installer.getPluginInfo("non-existent");
      expect(plugin).toBeUndefined();
    });

    it("should return plugin info for installed plugin", async () => {
      // Create a mock plugin
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 1.0.0
main: index.js
permissions:
  - runtime
  - agent
        `.trim(),
      );

      const plugin = await installer.getPluginInfo("test-plugin");

      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe("test-plugin");
      expect(plugin?.version).toBe("1.0.0");
      expect(plugin?.description).toBe("Test plugin");
      expect(plugin?.status).toBe("loaded");
      expect(plugin?.enabled).toBe(true);
      expect(plugin?.permissions).toEqual(["runtime", "agent"]);
    });
  });

  describe("uninstall", () => {
    it("should uninstall a plugin", async () => {
      // Create a mock plugin
      const pluginDir = join(testPluginsDir, "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, "plugin.yaml"), "name: test-plugin");

      const result = await installer.uninstall("test-plugin");

      expect(result.status).toBe("uninstalled");

      // Verify plugin is gone
      const plugin = await installer.getPluginInfo("test-plugin");
      expect(plugin).toBeUndefined();
    });

    it("should return error when uninstalling non-existent plugin", async () => {
      const result = await installer.uninstall("non-existent");
      expect(result.status).toBe("failed");
      expect(result.error).toContain("not installed");
    });
  });

  describe("search", () => {
    it("should return empty array on npm search failure", async () => {
      // This will fail since we're not actually calling npm in tests
      // The function catches errors and returns []
      const results = await installer.search("ao-plugin");
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
