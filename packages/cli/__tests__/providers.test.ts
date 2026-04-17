/**
 * Unit tests for Story 58.2: CLI providers command.
 * Tests the collectProvidersData function (extracted for testability).
 * AC: #7 (Task 6.5)
 */

import { describe, it, expect } from "vitest";
import { collectProvidersData } from "../src/commands/providers.js";
import { validateConfig } from "@composio/ao-core";

/** Mock plugin module for the "raw" provider */
const mockRawModule = {
  manifest: {
    name: "raw",
    slot: "provider" as const,
    description: "No-op provider",
    version: "0.1.0",
  },
  create: () => ({ name: "raw" }),
};

describe("CLI providers data collection", () => {
  it("collects registered providers and active configuration", async () => {
    const config = validateConfig({
      sessionEnhancement: { provider: "raw" },
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
        otherapp: {
          repo: "org/otherapp",
          path: "/tmp/otherapp",
          sessionEnhancement: { provider: "omc" },
        },
      },
    });

    const data = await collectProvidersData(config, async () => mockRawModule);

    // Should list registered providers
    expect(data.providers.length).toBeGreaterThanOrEqual(1);
    const rawManifest = data.providers.find((p) => p.name === "raw");
    expect(rawManifest).toBeDefined();
    expect(rawManifest?.slot).toBe("provider");

    // Should show global active provider
    expect(data.active).toContainEqual({ scope: "global", provider: "raw" });

    // Should show per-project override
    expect(data.active).toContainEqual({ scope: "project:otherapp", provider: "omc" });
  });

  it("returns empty active list when no providers configured", async () => {
    const config = validateConfig({
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const data = await collectProvidersData(config, async () => {
      throw new Error("not found");
    });
    expect(data.active).toEqual([]);
  });

  it("includes provider manifests with name, version, and description", async () => {
    const config = validateConfig({
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const data = await collectProvidersData(config, async () => mockRawModule);

    for (const manifest of data.providers) {
      expect(manifest.name).toBeTruthy();
      expect(manifest.version).toBeTruthy();
      expect(manifest.slot).toBe("provider");
    }
  });

  it("does not duplicate project provider matching global", async () => {
    const config = validateConfig({
      sessionEnhancement: { provider: "raw" },
      projects: {
        myapp: {
          repo: "org/myapp",
          path: "/tmp/myapp",
          sessionEnhancement: { provider: "raw" },
        },
      },
    });

    const data = await collectProvidersData(config, async () => mockRawModule);

    // Global provider is listed, but project override (same as global) is NOT duplicated
    const globalEntries = data.active.filter((a) => a.scope === "global");
    expect(globalEntries).toHaveLength(1);
    const projectEntries = data.active.filter((a) => a.scope === "project:myapp");
    expect(projectEntries).toHaveLength(0);
  });
});
