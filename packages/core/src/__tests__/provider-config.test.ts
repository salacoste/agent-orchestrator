/**
 * Unit tests for Story 58.2: Provider Configuration & Discovery.
 * Covers: model tier config, per-project cascade, extractPluginConfig,
 *         startup validation warning, CLI providers command.
 * AC: #7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateConfig } from "../config.js";
import {
  DEFAULT_MODEL_TIERS,
  type OrchestratorConfig,
  type ProjectConfig,
  type ModelTierMapping,
} from "../types.js";
import { createPluginRegistry } from "../plugin-registry.js";

// ---------------------------------------------------------------------------
// Re-import resolveModelTiers from session-manager for proper testing
// ---------------------------------------------------------------------------
import { resolveModelTiers as resolveModelTiersFromManager } from "../session-manager.js";

// ---------------------------------------------------------------------------
// AC #1, #6 — Model tier config
// ---------------------------------------------------------------------------

describe("Model tier config", () => {
  it("validates modelTiers in SessionEnhancementConfigSchema", () => {
    const config = validateConfig({
      sessionEnhancement: {
        provider: "raw",
        modelTiers: { low: "mini", medium: "pro", high: "ultra" },
      },
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
      },
    });
    expect(config.sessionEnhancement?.modelTiers).toEqual({
      low: "mini",
      medium: "pro",
      high: "ultra",
    });
  });

  it("omits modelTiers when not specified", () => {
    const config = validateConfig({
      sessionEnhancement: { provider: "raw" },
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
      },
    });
    expect(config.sessionEnhancement?.modelTiers).toBeUndefined();
  });

  it("rejects invalid tier keys", () => {
    expect(() =>
      validateConfig({
        sessionEnhancement: {
          provider: "raw",
          modelTiers: { low: "a", medium: "b", extra: "c" } as unknown as Record<string, unknown>,
        },
        projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
      }),
    ).toThrow();
  });

  it("rejects partial tier mappings (missing keys)", () => {
    expect(() =>
      validateConfig({
        sessionEnhancement: {
          provider: "raw",
          modelTiers: { low: "haiku", medium: "sonnet" } as unknown as Record<string, unknown>,
        },
        projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
      }),
    ).toThrow();
  });

  it("rejects empty string model values", () => {
    expect(() =>
      validateConfig({
        sessionEnhancement: {
          provider: "raw",
          modelTiers: { low: "", medium: "sonnet", high: "opus" },
        },
        projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
      }),
    ).toThrow();
  });

  it("exports DEFAULT_MODEL_TIERS with expected values", () => {
    expect(DEFAULT_MODEL_TIERS).toEqual({
      low: "haiku",
      medium: "sonnet",
      high: "opus",
    });
  });
});

// ---------------------------------------------------------------------------
// AC #3 — Per-project model tier cascade
// ---------------------------------------------------------------------------

describe("resolveModelTiers cascade", () => {
  function makeConfig(globalTiers?: ModelTierMapping): OrchestratorConfig {
    return {
      configPath: "/tmp/test.yaml",
      port: 5000,
      defaults: { runtime: "mock", agent: "mock", workspace: "mock", notifiers: [] },
      projects: {},
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
      readyThresholdMs: 300_000,
      sessionEnhancement: globalTiers ? { provider: "raw", modelTiers: globalTiers } : undefined,
    };
  }

  function makeProject(projectTiers?: ModelTierMapping): ProjectConfig {
    return {
      name: "Test",
      repo: "org/test",
      path: "/tmp/test",
      defaultBranch: "main",
      sessionPrefix: "test",
      sessionEnhancement: projectTiers ? { provider: "raw", modelTiers: projectTiers } : undefined,
    };
  }

  it("returns DEFAULT_MODEL_TIERS when no overrides", () => {
    const result = resolveModelTiersFromManager(makeConfig(), makeProject());
    expect(result).toEqual(DEFAULT_MODEL_TIERS);
  });

  it("returns global tiers when no project override", () => {
    const globalTiers: ModelTierMapping = { low: "g1", medium: "g2", high: "g3" };
    const result = resolveModelTiersFromManager(makeConfig(globalTiers), makeProject());
    expect(result).toEqual(globalTiers);
  });

  it("project override wins over global", () => {
    const globalTiers: ModelTierMapping = { low: "g1", medium: "g2", high: "g3" };
    const projectTiers: ModelTierMapping = { low: "p1", medium: "p2", high: "p3" };
    const result = resolveModelTiersFromManager(makeConfig(globalTiers), makeProject(projectTiers));
    expect(result).toEqual(projectTiers);
  });

  it("project override wins even without global", () => {
    const projectTiers: ModelTierMapping = { low: "p1", medium: "p2", high: "p3" };
    const result = resolveModelTiersFromManager(makeConfig(), makeProject(projectTiers));
    expect(result).toEqual(projectTiers);
  });
});

// ---------------------------------------------------------------------------
// AC #2 — extractPluginConfig passthrough
// ---------------------------------------------------------------------------

describe("extractPluginConfig provider passthrough", () => {
  it("passes config to provider when names match", async () => {
    const receivedConfigs: Array<Record<string, unknown> | undefined> = [];

    const mockModule = {
      manifest: { name: "raw", slot: "provider" as const, description: "test", version: "0.1.0" },
      create: (config?: Record<string, unknown>) => {
        receivedConfigs.push(config);
        return {
          name: "raw",
          install: async () => {},
          configure: async () => {},
          enhance: async (s: unknown) => s,
          teardown: async () => {},
          healthCheck: async () => ({ healthy: true, lastCheck: new Date() }),
        };
      },
    };

    const config = validateConfig({
      sessionEnhancement: {
        provider: "raw",
        config: { apiKey: "test-123" },
      },
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const registry = createPluginRegistry();
    await registry.loadBuiltins(config, async () => mockModule);

    expect(receivedConfigs.length).toBeGreaterThanOrEqual(1);
    // At least one call should have received the config
    const rawCall = receivedConfigs.find((c) => c && Object.keys(c).length > 0);
    expect(rawCall).toEqual({ apiKey: "test-123" });
  });

  it("returns undefined when provider name does not match", async () => {
    const receivedConfigs: Array<Record<string, unknown> | undefined> = [];

    const mockModule = {
      manifest: { name: "other", slot: "provider" as const, description: "test", version: "0.1.0" },
      create: (config?: Record<string, unknown>) => {
        receivedConfigs.push(config);
        return { name: "other" };
      },
    };

    const config = validateConfig({
      sessionEnhancement: {
        provider: "raw", // Configured for "raw", not "other"
        config: { apiKey: "test" },
      },
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const registry = createPluginRegistry();
    await registry.loadBuiltins(config, async () => mockModule);

    // "other" provider should NOT receive the config for "raw"
    expect(receivedConfigs).toContain(undefined);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — Startup provider validation
// ---------------------------------------------------------------------------

describe("Startup provider validation", () => {
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  it("warns when global provider is configured but not registered", async () => {
    const config = validateConfig({
      sessionEnhancement: { provider: "nonexistent" },
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const registry = createPluginRegistry();
    // Load builtins with no actual plugins available (empty import)
    await registry.loadBuiltins(config, async () => {
      throw new Error("not found");
    });

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("nonexistent"));
  });

  it("warns when per-project provider is configured but not registered", async () => {
    const config = validateConfig({
      projects: {
        myapp: {
          repo: "org/myapp",
          path: "/tmp/myapp",
          sessionEnhancement: { provider: "missing-project-provider" },
        },
      },
    });

    const registry = createPluginRegistry();
    await registry.loadBuiltins(config, async () => {
      throw new Error("not found");
    });

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("missing-project-provider"));
  });

  it("does not warn when configured provider is registered", async () => {
    const mockModule = {
      manifest: {
        name: "custom",
        slot: "provider" as const,
        description: "custom provider",
        version: "0.1.0",
      },
      create: () => ({ name: "custom" }),
    };

    const config = validateConfig({
      sessionEnhancement: { provider: "custom" },
      projects: { myapp: { repo: "org/myapp", path: "/tmp/myapp" } },
    });

    const registry = createPluginRegistry();
    await registry.loadBuiltins(config, async () => mockModule);

    // "custom" IS registered, so no warning should fire
    const providerWarnings = consoleWarn.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("[provider]"),
    );
    expect(providerWarnings).toHaveLength(0);
  });
});
