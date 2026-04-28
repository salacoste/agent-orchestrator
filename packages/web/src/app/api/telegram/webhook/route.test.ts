/**
 * Tests for Telegram webhook API route.
 * Story 57.1 Task 8.3 + Story 57.13 Task 4.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHandleUpdate = vi.fn();
const mockBotUse = vi.fn();
const mockBotCommand = vi.fn();
const mockRegisterConflicts = vi.fn();
const mockRegisterSetProject = vi.fn();
const mockRegisterCallbackHandler = vi.fn();
const mockRegisterCancelCommand = vi.fn();
const mockRegisterSpawnCommand = vi.fn();
const mockGetActive = vi.fn();

vi.mock("@composio/ao-plugin-notifier-telegram", () => ({
  TelegramBot: vi.fn().mockImplementation(() => ({
    handleUpdate: mockHandleUpdate,
    installAuthMiddleware: mockBotUse,
    registerStartCommand: mockBotCommand,
    registerStatusCommand: mockBotCommand,
    registerFleetCommand: mockBotCommand,
    registerSprintCommand: mockBotCommand,
    registerHealthCommand: mockBotCommand,
    registerConflictsCommand: mockRegisterConflicts,
    registerSetProjectCommand: mockRegisterSetProject,
    registerCallbackHandler: mockRegisterCallbackHandler,
    registerCancelCommand: mockRegisterCancelCommand,
    registerSpawnCommand: mockRegisterSpawnCommand,
  })),
}));

vi.mock("@composio/ao-core", () => ({
  ACTIVITY_STATE: { EXITED: "exited", BLOCKED: "blocked", IDLE: "idle" },
  createHealthCheckService: vi.fn(() => ({
    check: vi.fn(async () => ({
      overall: "healthy",
      components: [],
      timestamp: new Date(),
      exitCode: 0,
    })),
  })),
  createResourceConflictStore: vi.fn(() => ({
    getActive: mockGetActive,
  })),
}));

const mockApprove = vi.fn((id: string, _by: string) => ({
  success: true,
  approval: { id, action: "spawn", target: "agent-1", status: "approved" },
}));
const mockReject = vi.fn((id: string, _by: string) => ({
  success: true,
  approval: { id, action: "spawn", target: "agent-1", status: "rejected" },
}));

vi.mock("@/app/api/approvals/shared.js", () => ({
  approvalService: {
    approve: mockApprove,
    reject: mockReject,
    getPending: vi.fn(() => []),
    getAll: vi.fn(() => []),
  },
}));

vi.mock("@/lib/services.js", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {},
      notifiers: {
        telegram: {
          botToken: "test-token",
          defaultChatId: "12345",
          webhookSecret: "my-secret",
        },
      },
    },
    registry: new Map(),
    sessionManager: { list: vi.fn(async () => []) },
  })),
}));

const mockWriteStoryStatus = vi.fn();
const mockWriteStoryAssignment = vi.fn();

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  writeStoryStatus: mockWriteStoryStatus,
  writeStoryAssignment: mockWriteStoryAssignment,
}));

// Import after mocks — each test uses dynamic import for fresh module state

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    // Reset module-level cached bot between tests
    vi.resetModules();
  });

  it("returns 200 for valid secret and update", async () => {
    // Re-import to get fresh module state
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1, message: { text: "/start" } }),
    });

    const res = await freshPost(req as never);
    expect(res.status).toBe(200);
  });

  it("returns 401 for invalid secret", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await freshPost(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 for missing secret when configured", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await freshPost(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload without update_id", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ message: { text: "hello" } }),
    });

    const res = await freshPost(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 500 when handleUpdate throws", async () => {
    const { POST: freshPost } = await import("./route.js");
    mockHandleUpdate.mockRejectedValueOnce(new Error("Internal bot error"));

    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1, message: { text: "/start" } }),
    });

    const res = await freshPost(req as never);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// createConflictsProvider wiring tests (Story 57.9 code review)
// ---------------------------------------------------------------------------

describe("createConflictsProvider wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("wires provider that maps store conflicts to ConflictEntry format", async () => {
    mockGetActive.mockReturnValue([
      {
        id: "conf-1",
        resourceType: "repository",
        resourceIdentifier: "main-repo",
        competingProjects: ["api-service", "web-app"],
        severity: "critical",
        detectedAt: "2026-04-09T12:00:00.000Z",
        metadata: {},
      },
    ]);

    // Trigger getBot() via POST — this wires the provider
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1, message: { text: "/conflicts" } }),
    });
    await freshPost(req as never);

    // Verify registerConflictsCommand was called with a provider function
    expect(mockRegisterConflicts).toHaveBeenCalledTimes(1);
    const provider = mockRegisterConflicts.mock.calls[0][0] as () => Promise<unknown[]>;

    // Call the provider and verify the mapping
    const result = await provider();
    expect(result).toEqual([
      {
        id: "conf-1",
        resourceType: "repository",
        resourceIdentifier: "main-repo",
        competingProjects: ["api-service", "web-app"],
        severity: "critical",
        detectedAt: "2026-04-09T12:00:00.000Z",
      },
    ]);
    // metadata is NOT included in the mapping (by design)
  });

  it("provider returns empty array when store has no conflicts", async () => {
    mockGetActive.mockReturnValue([]);

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1, message: { text: "/conflicts" } }),
    });
    await freshPost(req as never);

    const provider = mockRegisterConflicts.mock.calls[0][0] as () => Promise<unknown[]>;
    const result = await provider();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Provider project filtering tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("Provider project filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("createConflictsProvider filters by projectId", async () => {
    mockGetActive.mockReturnValue([
      {
        id: "conf-1",
        resourceType: "repository",
        resourceIdentifier: "main-repo",
        competingProjects: ["api-service", "web-app"],
        severity: "critical",
        detectedAt: "2026-04-09T12:00:00.000Z",
        metadata: {},
      },
      {
        id: "conf-2",
        resourceType: "agent",
        resourceIdentifier: "agent-1",
        competingProjects: ["backend"],
        severity: "high",
        detectedAt: "2026-04-09T12:00:00.000Z",
        metadata: {},
      },
    ]);

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const provider = mockRegisterConflicts.mock.calls[0][0] as (
      projectId?: string,
    ) => Promise<unknown[]>;

    // With projectId filter
    const filtered = await provider("api-service");
    expect(filtered).toHaveLength(1);
    expect((filtered as Array<{ id: string }>)[0].id).toBe("conf-1");

    // Without projectId — returns all
    const all = await provider();
    expect(all).toHaveLength(2);
  });

  it("createConflictsProvider resolves display name to config key", async () => {
    // Override services mock with named projects
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: { "api-svc": { name: "API Service" } },
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    mockGetActive.mockReturnValue([
      {
        id: "conf-1",
        resourceType: "repository",
        resourceIdentifier: "main-repo",
        competingProjects: ["api-svc"],
        severity: "critical",
        detectedAt: "2026-04-09T12:00:00.000Z",
        metadata: {},
      },
    ]);

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const provider = mockRegisterConflicts.mock.calls[0][0] as (
      projectId?: string,
    ) => Promise<unknown[]>;

    // Display name "API Service" should resolve to config key "api-svc"
    const byDisplayName = await provider("API Service");
    expect(byDisplayName).toHaveLength(1);
    expect((byDisplayName as Array<{ id: string }>)[0].id).toBe("conf-1");

    // Config key should also work directly
    const byConfigKey = await provider("api-svc");
    expect(byConfigKey).toHaveLength(1);
  });

  it("createProjectListProvider returns project names from config", async () => {
    // Override services mock with projects config
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {
          "api-svc": { name: "API Service" },
          "web-app": { name: "Web App" },
        },
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    // registerSetProjectCommand should have been called with a provider
    expect(mockRegisterSetProject).toHaveBeenCalledTimes(1);
    const projectListProvider = mockRegisterSetProject.mock.calls[0][0] as () => string[];
    expect(projectListProvider()).toEqual(["API Service", "Web App"]);
  });
});

// ---------------------------------------------------------------------------
// Callback handler wiring tests (Story 57.11)
// ---------------------------------------------------------------------------

describe("registerCallbackHandler wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("wires registerCallbackHandler with resume and dismiss handlers", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterCallbackHandler).toHaveBeenCalledTimes(1);
    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    expect(typeof handlers.resume).toBe("function");
    expect(typeof handlers.dismiss).toBe("function");
  });

  it("resume handler calls sessionManager.send and returns success", async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {},
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []), send: mockSend },
    });

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    const result = await handlers.resume("agent-42");
    expect(mockSend).toHaveBeenCalledWith("agent-42", "resume");
    expect(result).toContain("agent-42");
  });

  it("dismiss handler returns Acknowledged", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    const result = await handlers.dismiss("anything");
    expect(result).toBe("Acknowledged");
  });
});

// ---------------------------------------------------------------------------
// TelegramBot constructor config tests (Story 57.11 second-pass review)
// ---------------------------------------------------------------------------

describe("TelegramBot constructor wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("passes dashboardBaseUrl from config to TelegramBot constructor", async () => {
    // Override services mock with dashboardBaseUrl
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {},
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
            dashboardBaseUrl: "http://dashboard.example.com",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    // Import TelegramBot mock to check constructor args
    const { TelegramBot: MockTelegramBot } = await import("@composio/ao-plugin-notifier-telegram");

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    // Verify TelegramBot was called with dashboardBaseUrl
    expect(MockTelegramBot).toHaveBeenCalledTimes(1);
    const constructorConfig = (MockTelegramBot as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(constructorConfig.dashboardBaseUrl).toBe("http://dashboard.example.com");
  });

  it("passes undefined dashboardBaseUrl when not configured", async () => {
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {},
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    const { TelegramBot: MockTelegramBot } = await import("@composio/ao-plugin-notifier-telegram");

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const constructorConfig = (MockTelegramBot as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(constructorConfig.dashboardBaseUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Approve/deny handler wiring tests (Story 57.12)
// ---------------------------------------------------------------------------

describe("registerCallbackHandler approve/deny wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("wires approve handler that calls approvalService.approve()", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterCallbackHandler).toHaveBeenCalledTimes(1);
    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    expect(typeof handlers.approve).toBe("function");

    const result = await handlers.approve("approval-id-1");
    expect(result).toContain("Approved by");
    expect(result).toContain("spawn");
  });

  it("wires deny handler that calls approvalService.reject()", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    expect(typeof handlers.deny).toBe("function");

    const result = await handlers.deny("approval-id-1");
    expect(result).toContain("Denied by");
  });

  it("approve handler returns 'Already resolved' for non-pending approval", async () => {
    // Override shared approval service mock to return already-approved result
    vi.doMock("@/app/api/approvals/shared.js", () => ({
      approvalService: {
        approve: vi.fn(() => ({
          success: false,
          approval: { id: "x", action: "spawn", target: "agent-1", status: "approved" },
        })),
        reject: vi.fn(() => ({
          success: true,
          approval: { id: "x", action: "spawn", target: "agent-1", status: "rejected" },
        })),
        getPending: vi.fn(() => []),
        getAll: vi.fn(() => []),
      },
    }));

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    const result = await handlers.approve("already-approved-id");
    expect(result).toBe("Already resolved");
  });

  it("approve handler returns 'Approval expired' for expired request", async () => {
    vi.doMock("@/app/api/approvals/shared.js", () => ({
      approvalService: {
        approve: vi.fn(() => ({
          success: false,
          approval: { id: "x", action: "spawn", target: "agent-1", status: "expired" },
        })),
        reject: vi.fn(() => ({
          success: true,
          approval: { id: "x", action: "spawn", target: "agent-1", status: "rejected" },
        })),
        getPending: vi.fn(() => []),
        getAll: vi.fn(() => []),
      },
    }));

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    const result = await handlers.approve("expired-id");
    expect(result).toBe("Approval expired");
  });

  it("approve handler returns error for approval service failure", async () => {
    vi.doMock("@/app/api/approvals/shared.js", () => ({
      approvalService: {
        approve: vi.fn(() => {
          throw new Error("DB connection failed");
        }),
        reject: vi.fn(() => ({
          success: true,
          approval: { id: "x", action: "spawn", target: "agent-1", status: "rejected" },
        })),
        getPending: vi.fn(() => []),
        getAll: vi.fn(() => []),
      },
    }));

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
    const result = await handlers.approve("unknown-id");
    expect(result).toContain("Approval failed");
    expect(result).toContain("DB connection failed");
  });
});

// ---------------------------------------------------------------------------
// Story action handler wiring tests (Story 57.13)
// ---------------------------------------------------------------------------

describe("registerCallbackHandler story action wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
    mockWriteStoryStatus.mockReturnValue(undefined);
    mockWriteStoryAssignment.mockReturnValue(undefined);
  });

  async function getHandlers(): Promise<Record<string, (targetId: string) => Promise<string>>> {
    // Override services mock with a project that has tracker config
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {
          "agent-orchestrator": {
            name: "Agent Orchestrator",
            tracker: { plugin: "bmad", epicPrefix: "49" },
          },
        },
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterCallbackHandler).toHaveBeenCalledTimes(1);
    return mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;
  }

  it("wires block handler that calls writeStoryStatus", async () => {
    const handlers = await getHandlers();
    expect(typeof handlers.block).toBe("function");

    const result = await handlers.block("49-1-portfolio-dashboard");
    expect(result).toContain("blocked");
    expect(result).toContain("49-1-portfolio-dashboard");
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });

  it("wires unblock handler that calls writeStoryStatus", async () => {
    const handlers = await getHandlers();
    expect(typeof handlers.unblock).toBe("function");

    const result = await handlers.unblock("49-1-portfolio-dashboard");
    expect(result).toContain("unblocked");
    expect(mockWriteStoryStatus).toHaveBeenCalledWith(
      expect.anything(),
      "49-1-portfolio-dashboard",
      "in-progress",
    );
  });

  it("wires priority handler that parses compound targetId", async () => {
    const handlers = await getHandlers();
    expect(typeof handlers.priority).toBe("function");

    const result = await handlers.priority("49-1-portfolio-dashboard:high");
    expect(result).toContain("high");
    expect(result).toContain("49-1-portfolio-dashboard");
  });

  it("priority handler returns selection prompt when no level", async () => {
    const handlers = await getHandlers();
    const result = await handlers.priority("49-1-portfolio-dashboard");
    expect(result).toContain("Select priority");
  });

  it("wires assign handler that calls writeStoryAssignment", async () => {
    const handlers = await getHandlers();
    expect(typeof handlers.assign).toBe("function");

    const result = await handlers.assign("49-1-portfolio-dashboard:agent-1");
    expect(result).toContain("agent-1");
    expect(result).toContain("49-1-portfolio-dashboard");
    expect(mockWriteStoryAssignment).toHaveBeenCalledWith(
      expect.anything(),
      "49-1-portfolio-dashboard",
      "agent-1",
    );
  });

  it("assign handler returns selection prompt when no agentId", async () => {
    const handlers = await getHandlers();
    const result = await handlers.assign("49-1-portfolio-dashboard");
    expect(result).toContain("Select agent");
  });

  it("block handler returns error when writeStoryStatus throws", async () => {
    const handlers = await getHandlers();
    mockWriteStoryStatus.mockImplementation(() => {
      throw new Error("Story not found");
    });

    const result = await handlers.block("49-1-story");
    expect(result).toContain("Could not block story");
    expect(result).toContain("Story not found");
  });

  it("assign handler returns error when writeStoryAssignment throws", async () => {
    const handlers = await getHandlers();
    mockWriteStoryAssignment.mockImplementation(() => {
      throw new Error("Agent unavailable");
    });

    const result = await handlers.assign("49-1-story:bad-agent");
    expect(result).toContain("Could not assign agent");
    expect(result).toContain("Agent unavailable");
  });
});

// ---------------------------------------------------------------------------
// resolveProjectForStory edge cases (Story 57.13 code review)
// ---------------------------------------------------------------------------

describe("resolveProjectForStory edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("skips projects with empty epicPrefix (wildcard guard)", async () => {
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {
          "project-a": {
            name: "Project A",
            tracker: { plugin: "bmad", epicPrefix: "" },
          },
          "project-b": {
            name: "Project B",
            tracker: { plugin: "bmad", epicPrefix: "50" },
          },
        },
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterCallbackHandler).toHaveBeenCalledTimes(1);
    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;

    // Block handler on a "50-1-*" story should resolve to project-b (epicPrefix "50"),
    // NOT project-a (empty epicPrefix wildcard)
    mockWriteStoryStatus.mockReturnValue(undefined);
    const result = await handlers.block("50-1-shared-pool");
    expect(result).toContain("blocked");
    expect(result).toContain("50-1-shared-pool");
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });

  it("falls back to single project when only one exists", async () => {
    const { getServices } = await import("@/lib/services.js");
    const mockedGetServices = getServices as ReturnType<typeof vi.fn>;
    mockedGetServices.mockResolvedValue({
      config: {
        projects: {
          "solo-project": {
            name: "Solo Project",
            // No tracker config at all
          },
        },
        notifiers: {
          telegram: {
            botToken: "test-token",
            defaultChatId: "12345",
            webhookSecret: "my-secret",
          },
        },
      },
      registry: new Map(),
      sessionManager: { list: vi.fn(async () => []) },
    });

    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    const handlers = mockRegisterCallbackHandler.mock.calls[0][0] as Record<
      string,
      (targetId: string) => Promise<string>
    >;

    mockWriteStoryStatus.mockReturnValue(undefined);
    const result = await handlers.block("99-1-anything");
    expect(result).toContain("blocked");
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// registerCancelCommand / registerSpawnCommand wiring tests (Story 57.14)
// ---------------------------------------------------------------------------

describe("registerCancelCommand and registerSpawnCommand wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUpdate.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("calls registerCancelCommand during getBot()", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterCancelCommand).toHaveBeenCalledTimes(1);
  });

  it("calls registerSpawnCommand during getBot()", async () => {
    const { POST: freshPost } = await import("./route.js");
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "my-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    await freshPost(req as never);

    expect(mockRegisterSpawnCommand).toHaveBeenCalledTimes(1);
    // First arg is project list provider, second is agent list provider
    expect(mockRegisterSpawnCommand.mock.calls[0][0]).toBeInstanceOf(Function);
    expect(mockRegisterSpawnCommand.mock.calls[0][1]).toBeInstanceOf(Function);
  });
});
