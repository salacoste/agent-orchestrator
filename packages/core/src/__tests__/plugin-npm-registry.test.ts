/**
 * NPM Plugin Registry Tests
 *
 * Tests the npm registry integration for plugin discovery and publishing.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createNpmPluginRegistry } from "../plugin-npm-registry.js";

describe("NpmPluginRegistry", () => {
  let testPluginDir: string;
  let registry: ReturnType<typeof createNpmPluginRegistry>;

  beforeEach(async () => {
    // Create temp directory for testing
    testPluginDir = `/tmp/ao-plugin-registry-test-${Date.now()}`;
    await mkdir(testPluginDir, { recursive: true });

    registry = createNpmPluginRegistry();
  });

  describe("validate", () => {
    it("should validate a valid plugin structure", async () => {
      // Create a valid plugin structure
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/ao-plugin-test",
          version: "1.0.0",
          description: "Test plugin",
          keywords: ["ao-plugin"],
        }),
      );

      await writeFile(
        join(testPluginDir, "plugin.yaml"),
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

      await writeFile(join(testPluginDir, "index.js"), "// main file");

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for missing package.json", async () => {
      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("package.json not found in plugin directory");
    });

    it("should fail validation for missing plugin.yaml", async () => {
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/ao-plugin-test",
          version: "1.0.0",
        }),
      );

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("plugin.yaml not found in plugin directory");
    });

    it("should fail validation for missing ao-plugin in name", async () => {
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/test-plugin", // Missing ao-plugin
          version: "1.0.0",
          keywords: ["ao-plugin"],
        }),
      );

      await writeFile(
        join(testPluginDir, "plugin.yaml"),
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

      await writeFile(join(testPluginDir, "index.js"), "// main file");

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("ao-plugin"))).toBe(true);
    });

    it("should fail validation for missing main file", async () => {
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/ao-plugin-test",
          version: "1.0.0",
          keywords: ["ao-plugin"],
        }),
      );

      await writeFile(
        join(testPluginDir, "plugin.yaml"),
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

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Main file not found"))).toBe(true);
    });

    it("should warn when keywords don't include ao-plugin", async () => {
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/ao-plugin-test",
          version: "1.0.0",
          keywords: ["plugin"], // Missing ao-plugin
        }),
      );

      await writeFile(
        join(testPluginDir, "plugin.yaml"),
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

      await writeFile(join(testPluginDir, "index.js"), "// main file");

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("ao-plugin"))).toBe(true);
    });

    it("should warn when API version differs", async () => {
      await writeFile(
        join(testPluginDir, "package.json"),
        JSON.stringify({
          name: "@scope/ao-plugin-test",
          version: "1.0.0",
          keywords: ["ao-plugin"],
        }),
      );

      await writeFile(
        join(testPluginDir, "plugin.yaml"),
        `
name: test-plugin
version: 1.0.0
description: Test plugin
apiVersion: 2.0.0
main: index.js
permissions:
  - runtime
      `.trim(),
      );

      await writeFile(join(testPluginDir, "index.js"), "// main file");

      const result = await registry.validate(testPluginDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("API version"))).toBe(true);
    });
  });

  describe("search", () => {
    it("should return empty array on npm search failure", async () => {
      // This will fail since we're not actually calling npm in tests
      // The function catches errors and returns []
      const results = await registry.search("ao-plugin");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("getDetails", () => {
    it("should return null for non-existent package", async () => {
      const details = await registry.getDetails(
        "@composio/ao-plugin-nonexistent-test-package-12345",
      );
      expect(details).toBeNull();
    });
  });
});
