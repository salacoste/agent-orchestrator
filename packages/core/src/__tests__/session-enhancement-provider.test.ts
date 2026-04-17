/**
 * Unit tests for SessionEnhancementProvider interface integration.
 * Covers: config validation, spawn flow, health check fallback, teardown in kill.
 * AC: #8 (Story 58.1)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { validateConfig } from "../config.js";
import { createSessionManager } from "../session-manager.js";
import { getSessionsDir, getProjectBaseDir } from "../paths.js";
import type {
  SessionEnhancementProvider,
  ProviderConfig,
  ProviderHealth,
  Session,
  OrchestratorConfig,
  PluginRegistry,
  Runtime,
  Agent,
  Workspace,
  RuntimeHandle,
} from "../types.js";

// ---------------------------------------------------------------------------
// Mock providers
// ---------------------------------------------------------------------------

function createMockProvider(
  name: string,
  behavior?: {
    installFn?: (path: string, cfg: ProviderConfig) => Promise<void>;
    configureFn?: (path: string, ctx: unknown) => Promise<void>;
    teardownFn?: (path: string) => Promise<void>;
    healthCheckFn?: () => Promise<ProviderHealth>;
  },
): SessionEnhancementProvider {
  return {
    name,
    install: behavior?.installFn ?? (async () => {}),
    configure: behavior?.configureFn ?? (async () => {}),
    enhance: async (session: Session) => session,
    teardown: behavior?.teardownFn ?? (async () => {}),
    healthCheck:
      behavior?.healthCheckFn ?? (async () => ({ healthy: true, lastCheck: new Date() })),
  };
}

// ---------------------------------------------------------------------------
// Config validation tests (pure, no file I/O needed)
// ---------------------------------------------------------------------------

describe("SessionEnhancementProvider — config validation", () => {
  it("accepts config without sessionEnhancement (defaults to raw)", () => {
    const config = validateConfig({
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
      },
    });
    expect(config.sessionEnhancement).toBeUndefined();
  });

  it("accepts config with global sessionEnhancement", () => {
    const config = validateConfig({
      sessionEnhancement: {
        provider: "custom",
        config: { apiKey: "test" },
      },
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
      },
    });
    expect(config.sessionEnhancement?.provider).toBe("custom");
    expect(config.sessionEnhancement?.config).toEqual({ apiKey: "test" });
  });

  it("accepts per-project sessionEnhancement override", () => {
    const config = validateConfig({
      sessionEnhancement: { provider: "global-provider" },
      projects: {
        myapp: {
          repo: "org/myapp",
          path: "/tmp/myapp",
          sessionEnhancement: { provider: "project-provider" },
        },
      },
    });
    const project = config.projects["myapp"];
    expect(project.sessionEnhancement?.provider).toBe("project-provider");
  });

  it("defaults provider to 'raw' when not specified", () => {
    const config = validateConfig({
      sessionEnhancement: {},
      projects: {
        myapp: { repo: "org/myapp", path: "/tmp/myapp" },
      },
    });
    expect(config.sessionEnhancement?.provider).toBe("raw");
  });
});

// ---------------------------------------------------------------------------
// Spawn integration tests (require temp directories for metadata)
// ---------------------------------------------------------------------------

describe("SessionEnhancementProvider — spawn integration", () => {
  let tmpDir: string;
  let configPath: string;
  let sessionsDir: string;
  let config: OrchestratorConfig;
  let mockRegistry: PluginRegistry;
  let mockProvider: SessionEnhancementProvider;
  let rawProvider: SessionEnhancementProvider;

  function makeHandle(id: string): RuntimeHandle {
    return { id, runtimeName: "mock", data: {} };
  }

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ao-test-provider-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });

    configPath = join(tmpDir, "agent-orchestrator.yaml");
    writeFileSync(configPath, "projects: {}\n");

    const projectPath = join(tmpDir, "my-app");
    mkdirSync(projectPath, { recursive: true });

    sessionsDir = getSessionsDir(configPath, projectPath);
    mkdirSync(sessionsDir, { recursive: true });

    mockProvider = createMockProvider("test-provider");
    rawProvider = createMockProvider("raw");

    const mockRuntime: Runtime = {
      name: "mock",
      create: vi.fn().mockResolvedValue(makeHandle("rt-1")),
      destroy: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      getOutput: vi.fn().mockResolvedValue(""),
      isAlive: vi.fn().mockResolvedValue(true),
    };

    const mockAgent: Agent = {
      name: "mock-agent",
      processName: "mock",
      getLaunchCommand: vi.fn().mockReturnValue("mock-agent --start"),
      getEnvironment: vi.fn().mockReturnValue({}),
      detectActivity: vi.fn().mockReturnValue("active"),
      getActivityState: vi.fn().mockResolvedValue(null),
      isProcessRunning: vi.fn().mockResolvedValue(true),
      getSessionInfo: vi.fn().mockResolvedValue(null),
    };

    const mockWorkspace: Workspace = {
      name: "mock-ws",
      create: vi.fn().mockResolvedValue({
        path: join(tmpDir, "ws-app-1"),
        branch: "feat/test",
        sessionId: "app-1",
        projectId: "my-app",
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };

    // Use a mock registry that delegates to our mocks based on slot/name
    const providerMap: Record<string, SessionEnhancementProvider> = {};

    mockRegistry = {
      register: vi.fn(),
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "workspace") return mockWorkspace;
        if (slot === "provider") {
          return providerMap[name] ?? null;
        }
        return null;
      }) as unknown as PluginRegistry["get"],
      list: vi.fn().mockReturnValue([]),
      loadBuiltins: vi.fn().mockResolvedValue(undefined),
      loadFromConfig: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(true),
      shutdownAll: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(true),
      getPluginState: vi.fn().mockReturnValue(null),
      isRegistered: vi.fn().mockReturnValue(false),
    };

    // Make providerMap accessible to tests via a setter
    (
      mockRegistry as unknown as {
        _setProvider: (n: string, p: SessionEnhancementProvider) => void;
      }
    )._setProvider = (name: string, p: SessionEnhancementProvider) => {
      providerMap[name] = p;
    };

    config = {
      configPath,
      port: 5000,
      defaults: {
        runtime: "mock",
        agent: "mock-agent",
        workspace: "mock-ws",
        notifiers: [],
      },
      projects: {
        "my-app": {
          name: "My App",
          repo: "org/my-app",
          path: projectPath,
          defaultBranch: "main",
          sessionPrefix: "app",
        },
      },
      notifiers: {},
      notificationRouting: {
        urgent: ["desktop"],
        action: ["desktop"],
        warning: [],
        info: [],
      },
      reactions: {},
      readyThresholdMs: 300_000,
    } as OrchestratorConfig;
  });

  afterEach(() => {
    const projectBaseDir = getProjectBaseDir(configPath, config.projects["my-app"].path);
    if (existsSync(projectBaseDir)) {
      rmSync(projectBaseDir, { recursive: true, force: true });
    }
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("calls provider.install and provider.configure during spawn", async () => {
    const installSpy = vi.fn().mockImplementation(async (wsPath: string) => {
      // Simulate what a real provider does — create .omc/ so verification passes
      mkdirSync(join(wsPath, ".omc"), { recursive: true });
    });
    const configureSpy = vi.fn().mockImplementation(async (wsPath: string) => {
      // Simulate what a real provider does — create notepad.md so verification passes
      writeFileSync(join(wsPath, ".omc", "notepad.md"), "# Notepad\n", "utf-8");
    });

    mockProvider = createMockProvider("test-provider", {
      installFn: installSpy,
      configureFn: configureSpy,
    });

    // Register providers
    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("test-provider", mockProvider);
    reg._setProvider("raw", rawProvider);

    // Configure project to use test-provider
    config.projects["my-app"].sessionEnhancement = { provider: "test-provider" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    expect(session.id).toBeTruthy();
    expect(installSpy).toHaveBeenCalled();
    expect(configureSpy).toHaveBeenCalled();
  });

  it("falls back to raw provider when install throws", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const failingProvider = createMockProvider("failing", {
      installFn: async () => {
        throw new Error("install failed");
      },
    });

    const rawInstallSpy = vi.fn().mockResolvedValue(undefined);
    rawProvider = createMockProvider("raw", {
      installFn: rawInstallSpy,
    });

    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("failing", failingProvider);
    reg._setProvider("raw", rawProvider);

    config.projects["my-app"].sessionEnhancement = { provider: "failing" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    // Session should still succeed despite provider failure
    expect(session.id).toBeTruthy();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("install failed"),
      expect.any(Error),
    );
    // Raw provider's install must be called after fallback
    expect(rawInstallSpy).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("falls back to raw provider when healthCheck returns unhealthy", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unhealthyProvider = createMockProvider("unhealthy", {
      healthCheckFn: async () => ({
        healthy: false,
        message: "service down",
        lastCheck: new Date(),
      }),
    });

    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("unhealthy", unhealthyProvider);
    reg._setProvider("raw", rawProvider);

    config.projects["my-app"].sessionEnhancement = { provider: "unhealthy" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    expect(session.id).toBeTruthy();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("unhealthy"));

    consoleWarn.mockRestore();
  });

  it("falls back to raw provider when configure throws", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const failingProvider = createMockProvider("failing-configure", {
      installFn: async (wsPath: string) => {
        // Create .omc/ so post-install verification passes
        mkdirSync(join(wsPath, ".omc"), { recursive: true });
      },
      configureFn: async () => {
        throw new Error("configure failed");
      },
    });

    const rawConfigureSpy = vi.fn().mockResolvedValue(undefined);
    rawProvider = createMockProvider("raw", {
      configureFn: rawConfigureSpy,
    });

    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("failing-configure", failingProvider);
    reg._setProvider("raw", rawProvider);

    config.projects["my-app"].sessionEnhancement = { provider: "failing-configure" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    // Session should still succeed despite configure failure
    expect(session.id).toBeTruthy();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("configure failed"),
      expect.any(Error),
    );
    // Raw provider's configure must be called after fallback
    expect(rawConfigureSpy).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("resolves provider from global config when project has no override", async () => {
    const globalInstallSpy = vi.fn().mockImplementation(async (wsPath: string) => {
      mkdirSync(join(wsPath, ".omc"), { recursive: true });
    });
    const globalConfigureSpy = vi.fn().mockImplementation(async (wsPath: string) => {
      writeFileSync(join(wsPath, ".omc", "notepad.md"), "# Notepad\n", "utf-8");
    });
    const globalProvider = createMockProvider("global-prov", {
      installFn: globalInstallSpy,
      configureFn: globalConfigureSpy,
    });

    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("global-prov", globalProvider);
    reg._setProvider("raw", rawProvider);

    // Only global config, no project override
    config.sessionEnhancement = { provider: "global-prov" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    expect(session.id).toBeTruthy();
    expect(globalInstallSpy).toHaveBeenCalled();
  });

  it("calls provider.teardown during kill", async () => {
    const teardownSpy = vi.fn().mockResolvedValue(undefined);
    mockProvider = createMockProvider("test-provider", {
      installFn: async (wsPath: string) => {
        mkdirSync(join(wsPath, ".omc"), { recursive: true });
      },
      configureFn: async (wsPath: string) => {
        writeFileSync(join(wsPath, ".omc", "notepad.md"), "# Notepad\n", "utf-8");
      },
      teardownFn: teardownSpy,
    });

    const reg = mockRegistry as unknown as {
      _setProvider: (n: string, p: SessionEnhancementProvider) => void;
    };
    reg._setProvider("test-provider", mockProvider);
    reg._setProvider("raw", rawProvider);

    config.projects["my-app"].sessionEnhancement = { provider: "test-provider" };

    const sm = createSessionManager({ config, registry: mockRegistry });
    const session = await sm.spawn({
      projectId: "my-app",
      prompt: "do something",
    });

    await sm.kill(session.id);
    expect(teardownSpy).toHaveBeenCalled();
  });
});
