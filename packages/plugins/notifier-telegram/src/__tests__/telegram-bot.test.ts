/**
 * Tests for TelegramBot wrapper — token validation, authorization, mode selection.
 * Story 57.1 Task 8.2 + Story 57.5 /status command + Story 57.6 /fleet command + Story 57.7 /sprint command + Story 57.8 /health command + Story 57.9 /conflicts command + Story 57.11 callback handler + Story 57.13 story quick actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TelegramBot,
  formatStatusMessage,
  formatFleetMessage,
  formatSprintMessage,
  formatHealthMessage,
  formatConflictsMessage,
  parseProjectArg,
  encodeCallbackData,
  decodeCallbackData,
  buildNotificationButtons,
  buildApprovalButtons,
  formatApprovalMessage,
  buildStoryActionButtons,
  formatStoryActionMessage,
  type SystemStatus,
  type FleetAgent,
  type SprintEntry,
  type HealthCheckResult,
  type ConflictEntry,
} from "../telegram-bot.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetMe = vi.fn();
const mockSendMessage = vi.fn();
const mockDeleteWebhook = vi.fn();
const mockSetWebhook = vi.fn();
const mockBotStart = vi.fn();
const mockBotStop = vi.fn();
const mockBotUse = vi.fn();
const mockBotCommand = vi.fn();
const mockHandleUpdate = vi.fn();
const mockBotCallbackQuery = vi.fn();

vi.mock("grammy", () => {
  return {
    Bot: vi.fn().mockImplementation(() => ({
      api: {
        getMe: mockGetMe,
        sendMessage: mockSendMessage,
        deleteWebhook: mockDeleteWebhook,
        setWebhook: mockSetWebhook,
      },
      start: mockBotStart,
      stop: mockBotStop,
      use: mockBotUse,
      command: mockBotCommand,
      handleUpdate: mockHandleUpdate,
      callbackQuery: mockBotCallbackQuery,
    })),
    session: vi.fn(() => vi.fn()),
    Api: {},
    RawApi: {},
  };
});

vi.mock("@grammyjs/conversations", () => ({
  conversations: vi.fn(() => vi.fn()),
  createConversation: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TelegramBot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Token Validation (Task 2)
  // -------------------------------------------------------------------------

  describe("validateToken", () => {
    it("returns valid=true with bot info on success", async () => {
      mockGetMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });

      const bot = new TelegramBot({ botToken: "test-token" });
      const result = await bot.validateToken();

      expect(result.valid).toBe(true);
      expect(result.botInfo).toEqual({
        id: 123456789,
        username: "test_bot",
        firstName: "Test Bot",
      });
    });

    it("returns valid=false with error message on failure", async () => {
      mockGetMe.mockRejectedValue(new Error("Unauthorized"));

      const bot = new TelegramBot({ botToken: "bad-token" });
      const result = await bot.validateToken();

      expect(result.valid).toBe(false);
      expect(result.error).toContain("validation failed");
      expect(result.error).toContain("BotFather");
    });

    it("caches bot info after successful validation", async () => {
      mockGetMe.mockResolvedValue({
        id: 111,
        username: "cached_bot",
        first_name: "Cached",
      });

      const bot = new TelegramBot({ botToken: "token" });
      await bot.validateToken();
      expect(bot.botInfo?.username).toBe("cached_bot");
    });
  });

  // -------------------------------------------------------------------------
  // Authorization Middleware (Task 3)
  // -------------------------------------------------------------------------

  describe("installAuthMiddleware", () => {
    it("logs warning and does not install middleware when no allowedChatIds", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const bot = new TelegramBot({ botToken: "token" });
      // Constructor calls bot.use() for session + conversations — clear those
      mockBotUse.mockClear();
      bot.installAuthMiddleware();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("open mode"));
      expect(mockBotUse).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("installs middleware when allowedChatIds is set", () => {
      const bot = new TelegramBot({
        botToken: "token",
        allowedChatIds: [12345],
      });
      mockBotUse.mockClear();
      bot.installAuthMiddleware();
      expect(mockBotUse).toHaveBeenCalledTimes(1);
    });
  });

  describe("registerStartCommand", () => {
    it("registers a 'start' command handler", () => {
      const bot = new TelegramBot({ botToken: "token" });
      bot.registerStartCommand();
      expect(mockBotCommand).toHaveBeenCalledWith("start", expect.any(Function));
    });
  });

  // -------------------------------------------------------------------------
  // Mode Selection (Task 5)
  // -------------------------------------------------------------------------

  describe("start", () => {
    it("starts polling by default", async () => {
      mockDeleteWebhook.mockResolvedValue(true);
      mockBotStart.mockImplementation(async (opts) => {
        if (opts.onStart) opts.onStart({ username: "test_bot" });
      });

      const bot = new TelegramBot({ botToken: "token" });
      await bot.start();

      expect(mockDeleteWebhook).toHaveBeenCalledWith({ drop_pending_updates: true });
      expect(mockBotStart).toHaveBeenCalledWith(
        expect.objectContaining({ drop_pending_updates: true }),
      );
    });

    it("registers webhook in webhook mode", async () => {
      mockSetWebhook.mockResolvedValue(true);

      const bot = new TelegramBot({
        botToken: "token",
        mode: "webhook",
        webhookUrl: "https://example.com/api/telegram/webhook",
        webhookSecret: "secret123",
      });
      await bot.start();

      expect(mockSetWebhook).toHaveBeenCalledWith(
        "https://example.com/api/telegram/webhook",
        expect.objectContaining({
          secret_token: "secret123",
          drop_pending_updates: true,
        }),
      );
    });

    it("throws if webhook mode but no URL", async () => {
      const bot = new TelegramBot({
        botToken: "token",
        mode: "webhook",
      });
      await expect(bot.start()).rejects.toThrow("webhookUrl is required");
    });

    it("polling mode overrides config mode", async () => {
      mockDeleteWebhook.mockResolvedValue(true);
      mockBotStart.mockResolvedValue(undefined);

      const bot = new TelegramBot({
        botToken: "token",
        mode: "webhook",
        webhookUrl: "https://example.com/hook",
      });
      await bot.start("polling");

      expect(mockBotStart).toHaveBeenCalled();
      expect(mockSetWebhook).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("calls bot.stop()", async () => {
      mockBotStop.mockResolvedValue(undefined);
      const bot = new TelegramBot({ botToken: "token" });
      await bot.stop();
      expect(mockBotStop).toHaveBeenCalled();
    });
  });

  describe("handleUpdate", () => {
    it("delegates to bot.handleUpdate", async () => {
      mockHandleUpdate.mockResolvedValue(undefined);
      const bot = new TelegramBot({ botToken: "token" });
      await bot.handleUpdate({ update_id: 1, message: {} });
      expect(mockHandleUpdate).toHaveBeenCalledWith({ update_id: 1, message: {} });
    });
  });

  // -------------------------------------------------------------------------
  // /status Command (Story 57.5)
  // -------------------------------------------------------------------------

  describe("registerStatusCommand", () => {
    it("registers a 'status' command handler on the bot", () => {
      const bot = new TelegramBot({ botToken: "token" });
      bot.registerStatusCommand(async () => ({
        activeAgents: 0,
        totalSessions: 0,
        workingSessions: 0,
        blockedSessions: 0,
        idleSessions: 0,
        openPRs: 0,
        needsReview: 0,
        healthStatus: "unknown",
        timestamp: "",
      }));
      expect(mockBotCommand).toHaveBeenCalledWith("status", expect.any(Function));
    });
  });
});

// ---------------------------------------------------------------------------
// formatStatusMessage tests (Story 57.5)
// ---------------------------------------------------------------------------

describe("formatStatusMessage", () => {
  const baseStatus: SystemStatus = {
    activeAgents: 3,
    totalSessions: 5,
    workingSessions: 2,
    blockedSessions: 1,
    idleSessions: 0,
    openPRs: 1,
    needsReview: 0,
    healthStatus: "healthy",
    timestamp: "2026-04-09T12:00:00.000Z",
  };

  it("formats healthy status with green emoji and agent counts", () => {
    const msg = formatStatusMessage(baseStatus);
    expect(msg).toContain("\u{1F4CA}");
    expect(msg).toContain("\u{1F7E2}");
    expect(msg).toContain("Healthy");
    expect(msg).toContain("3 online");
    expect(msg).toContain("5 total");
    expect(msg).toContain("Working: 2");
    expect(msg).toContain("Blocked: 1");
    expect(msg).toContain("PRs open: 1");
  });

  it("formats degraded status with yellow emoji", () => {
    const msg = formatStatusMessage({ ...baseStatus, healthStatus: "degraded" });
    expect(msg).toContain("\u{1F7E1}");
    expect(msg).toContain("Degraded");
  });

  it("formats unhealthy status with red emoji", () => {
    const msg = formatStatusMessage({ ...baseStatus, healthStatus: "unhealthy" });
    expect(msg).toContain("\u{1F534}");
    expect(msg).toContain("Unhealthy");
  });

  it("formats unknown status with black circle emoji", () => {
    const msg = formatStatusMessage({ ...baseStatus, healthStatus: "unknown" });
    expect(msg).toContain("\u26AB");
    expect(msg).toContain("Unknown");
  });

  it("shows 'No active sessions' when activeAgents is 0", () => {
    const empty: SystemStatus = {
      activeAgents: 0,
      totalSessions: 0,
      workingSessions: 0,
      blockedSessions: 0,
      idleSessions: 0,
      openPRs: 0,
      needsReview: 0,
      healthStatus: "healthy",
      timestamp: "",
    };
    const msg = formatStatusMessage(empty);
    expect(msg).toContain("No active sessions");
    expect(msg).not.toContain("Working:");
  });

  it("escapes healthMessage with escapeMarkdownV2", () => {
    const msg = formatStatusMessage({
      ...baseStatus,
      healthMessage: "test [status]",
    });
    // Square brackets must be escaped in MarkdownV2
    expect(msg).toContain("test \\[status\\]");
  });

  it("includes escaped timestamp when provided", () => {
    const msg = formatStatusMessage({ ...baseStatus, timestamp: "2026-04-09T12:00:00.000Z" });
    expect(msg).toContain("\u{1F552}");
    expect(msg).toContain("2026\\-04\\-09T12:00:00\\.000Z");
  });

  it("omits timestamp line when timestamp is empty", () => {
    const msg = formatStatusMessage({ ...baseStatus, timestamp: "" });
    expect(msg).not.toContain("\u{1F552}");
  });
});

// ---------------------------------------------------------------------------
// registerStatusCommand handler tests (Story 57.5 — code review follow-up)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("status", fn). */
function getStatusHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "status");
  if (!call) throw new Error("No 'status' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerStatusCommand handler behavior", () => {
  const baseStatus: SystemStatus = {
    activeAgents: 1,
    totalSessions: 2,
    workingSessions: 1,
    blockedSessions: 0,
    idleSessions: 0,
    openPRs: 0,
    needsReview: 0,
    healthStatus: "healthy",
    timestamp: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls provider and replies with formatted message", async () => {
    const provider = vi.fn().mockResolvedValue(baseStatus);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Agent Orchestrator Status"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles provider error gracefully — replies with fallback, no throw", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("SessionManager crashed"));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    // Must NOT throw
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SessionManager crashed"));
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Status unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
  });

  it("handles provider timeout — replies with fallback", async () => {
    // Provider that never resolves (simulates timeout)
    const provider = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    // Use fake timers to fast-forward past the 3s timeout
    vi.useFakeTimers();
    const handlerPromise = handler({ reply: mockReply });
    await vi.advanceTimersByTimeAsync(4_000);
    await handlerPromise;

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Status unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fallback reply catch prevents double-throw on network failure", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("provider error"));
    // Both the main reply and fallback reply will fail
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    // Must NOT throw even when fallback reply also fails
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("provider error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatFleetMessage tests (Story 57.6)
// ---------------------------------------------------------------------------

describe("formatFleetMessage", () => {
  const healthyAgent: FleetAgent = {
    id: "app-1",
    project: "my-project",
    status: "working",
    activity: "active",
    story: "AO-42",
    branch: "feature-x",
    isAlert: false,
  };

  const blockedAgent: FleetAgent = {
    id: "api-1",
    project: "api-service",
    status: "blocked",
    activity: "blocked",
    story: "AO-44",
    isAlert: true,
  };

  const idleAgent: FleetAgent = {
    id: "svc-2",
    project: "backend",
    status: "idle",
    activity: "idle",
    isAlert: false,
  };

  it("formats multiple agents with status emojis and agent rows", () => {
    const msg = formatFleetMessage([healthyAgent, blockedAgent]);
    expect(msg).toContain("*Agent Fleet*");
    expect(msg).toContain("2 agents");
    expect(msg).toContain("app\\-1");
    expect(msg).toContain("api\\-1");
    expect(msg).toContain("my\\-project");
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("AO\\-42");
    expect(msg).toContain("AO\\-44");
    expect(msg).toContain("1 healthy, 1 alert");
  });

  it("shows 'No active agents' for empty array", () => {
    const msg = formatFleetMessage([]);
    expect(msg).toContain("No active agents");
    expect(msg).not.toContain("healthy");
  });

  it("highlights alert agents with warning emoji prefix", () => {
    const msg = formatFleetMessage([blockedAgent]);
    expect(msg).toContain("\u26A0\uFE0F");
    expect(msg).toContain("\u{1F534}"); // red circle for blocked
  });

  it("uses green circle for active/working agents", () => {
    const msg = formatFleetMessage([healthyAgent]);
    expect(msg).toContain("\u{1F7E2}"); // green circle
  });

  it("uses yellow circle for idle agents", () => {
    const msg = formatFleetMessage([idleAgent]);
    expect(msg).toContain("\u{1F7E1}"); // yellow circle
  });

  it("uses green circle for ready agents (default fallback)", () => {
    const agent: FleetAgent = {
      id: "app-4",
      project: "svc",
      status: "working",
      activity: "ready",
      isAlert: false,
    };
    const msg = formatFleetMessage([agent]);
    expect(msg).toContain("\u{1F7E2}"); // green circle (default)
  });

  it("escapes dynamic content in agent fields", () => {
    const agent: FleetAgent = {
      id: "app-1.test",
      project: "my [project]",
      status: "working",
      activity: "active",
      story: "AO-42",
      isAlert: false,
    };
    const msg = formatFleetMessage([agent]);
    expect(msg).toContain("app\\-1\\.test");
    expect(msg).toContain("my \\[project\\]");
  });

  it("shows dash for agents without a story", () => {
    const agent: FleetAgent = {
      id: "app-3",
      project: "svc",
      status: "working",
      activity: "active",
      isAlert: false,
    };
    const msg = formatFleetMessage([agent]);
    expect(msg).toContain("\u2014");
  });

  it("shows 'alerts' plural when multiple alert agents", () => {
    const agents: FleetAgent[] = [
      { ...blockedAgent, id: "a-1" },
      { ...blockedAgent, id: "a-2" },
    ];
    const msg = formatFleetMessage(agents);
    expect(msg).toContain("2 alerts");
  });

  it("shows 'alert' singular when single alert agent", () => {
    const msg = formatFleetMessage([blockedAgent]);
    expect(msg).toContain("1 alert");
    expect(msg).not.toContain("1 alerts");
  });
});

// ---------------------------------------------------------------------------
// registerFleetCommand tests (Story 57.6)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("fleet", fn). */
function getFleetHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "fleet");
  if (!call) throw new Error("No 'fleet' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerFleetCommand", () => {
  const healthyAgent: FleetAgent = {
    id: "app-1",
    project: "my-project",
    status: "working",
    activity: "active",
    isAlert: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'fleet' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(async () => []);
    expect(mockBotCommand).toHaveBeenCalledWith("fleet", expect.any(Function));
  });

  it("calls provider and replies with formatted message", async () => {
    const provider = vi.fn().mockResolvedValue([healthyAgent]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(provider);

    const handler = getFleetHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Agent Fleet"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles provider error gracefully — replies with fallback", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("SessionManager crashed"));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(provider);

    const handler = getFleetHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SessionManager crashed"));
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Fleet unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
  });

  it("handles timeout — replies with fallback", async () => {
    const provider = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(provider);

    const handler = getFleetHandler();
    vi.useFakeTimers();
    const handlerPromise = handler({ reply: mockReply });
    await vi.advanceTimersByTimeAsync(4_000);
    await handlerPromise;

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Fleet unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fallback reply catch prevents double-throw on network failure", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("provider error"));
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(provider);

    const handler = getFleetHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("provider error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatSprintMessage tests (Story 57.7)
// ---------------------------------------------------------------------------

describe("formatSprintMessage", () => {
  const onTrackEntry: SprintEntry = {
    projectName: "my-project",
    sprintName: "my-project Sprint",
    progressPercent: 80,
    status: "active",
    health: "on-track",
    velocityTrend: "improving",
    stories: { total: 10, done: 8, inProgress: 1, blocked: 0, backlog: 1 },
  };

  const atRiskEntry: SprintEntry = {
    projectName: "api-service",
    sprintName: "api-service Sprint",
    progressPercent: 50,
    status: "active",
    health: "at-risk",
    velocityTrend: "stable",
    stories: { total: 6, done: 3, inProgress: 1, blocked: 2, backlog: 0 },
    healthReasons: ["2 blocked agents"],
    blockers: ["agent-1 (AO-42)"],
  };

  const blockedEntry: SprintEntry = {
    projectName: "backend",
    sprintName: "backend Sprint",
    progressPercent: 20,
    status: "active",
    health: "blocked",
    velocityTrend: "declining",
    stories: { total: 5, done: 1, inProgress: 0, blocked: 3, backlog: 1 },
    healthReasons: ["3 blocked agents"],
    blockers: ["svc-1 (AO-10)", "svc-2 (no story)", "svc-3 (AO-12)"],
  };

  it("shows 'No active sprints' for empty array", () => {
    const msg = formatSprintMessage([]);
    expect(msg).toContain("No active sprints");
    expect(msg).toContain("*Sprint Overview*");
    expect(msg).not.toContain("on\\-track");
  });

  it("formats summary view for multiple projects", () => {
    const msg = formatSprintMessage([onTrackEntry, atRiskEntry]);
    expect(msg).toContain("*Sprint Overview*");
    expect(msg).toContain("2 projects");
    expect(msg).toContain("my\\-project");
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("80%");
    expect(msg).toContain("50%");
    expect(msg).toContain("1 on\\-track");
    expect(msg).toContain("1 at\\-risk");
  });

  it("formats detailed view for single project with projectName", () => {
    const msg = formatSprintMessage([onTrackEntry], "my-project");
    expect(msg).toContain("*Sprint: my\\-project*");
    expect(msg).toContain("Health:");
    expect(msg).toContain("track");
    expect(msg).toContain("improving");
    expect(msg).toContain("Stories: 10 total");
    expect(msg).toContain("Done: 8");
    expect(msg).toContain("Active: 1");
    expect(msg).toContain("Blocked: 0");
    expect(msg).toContain("Backlog: 1");
    expect(msg).toContain("80% complete");
    expect(msg).not.toContain("projects");
  });

  it("uses green circle for on-track health", () => {
    const msg = formatSprintMessage([onTrackEntry], "my-project");
    expect(msg).toContain("\u{1F7E2}"); // green circle
  });

  it("uses yellow circle for at-risk health", () => {
    const msg = formatSprintMessage([atRiskEntry], "api-service");
    expect(msg).toContain("\u{1F7E1}"); // yellow circle
  });

  it("uses red circle for blocked health", () => {
    const msg = formatSprintMessage([blockedEntry], "backend");
    expect(msg).toContain("\u{1F534}"); // red circle
  });

  it("shows health reasons and blockers in detailed view", () => {
    const msg = formatSprintMessage([atRiskEntry], "api-service");
    expect(msg).toContain("\u26A0\uFE0F"); // warning emoji
    expect(msg).toContain("2 blocked agents");
    expect(msg).toContain("\u{1F6A8}"); // police car emoji for blocked agents
    expect(msg).toContain("agent\\-1");
    expect(msg).toContain("AO\\-42");
  });

  it("escapes dynamic content in project names", () => {
    const entry: SprintEntry = {
      projectName: "my [project].test",
      sprintName: "my [project].test Sprint",
      progressPercent: 50,
      status: "active",
      health: "on-track",
      velocityTrend: "stable",
      stories: { total: 4, done: 2, inProgress: 1, blocked: 0, backlog: 1 },
    };
    const msg = formatSprintMessage([entry]);
    expect(msg).toContain("my \\[project\\]\\.test");
  });

  it("uses unknown emoji (black circle) for unknown health", () => {
    const entry: SprintEntry = {
      projectName: "svc",
      sprintName: "svc Sprint",
      progressPercent: 0,
      status: "planning",
      health: "unknown",
      velocityTrend: "unknown",
      stories: { total: 0, done: 0, inProgress: 0, blocked: 0, backlog: 0 },
    };
    const msg = formatSprintMessage([entry]);
    expect(msg).toContain("\u26AB"); // black circle
    expect(msg).toContain("\u2753"); // question mark for unknown velocity
  });

  it("uses correct velocity trend emojis in summary view", () => {
    const entries: SprintEntry[] = [
      { ...onTrackEntry, velocityTrend: "improving" },
      { ...atRiskEntry, velocityTrend: "declining" },
      { ...blockedEntry, velocityTrend: "stable" },
    ];
    const msg = formatSprintMessage(entries);
    expect(msg).toContain("\u{1F4C8}"); // chart increasing
    expect(msg).toContain("\u{1F4C9}"); // chart decreasing
    expect(msg).toContain("\u27A1\uFE0F"); // right arrow
  });
});

// ---------------------------------------------------------------------------
// registerSprintCommand tests (Story 57.7)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("sprint", fn). */
function getSprintHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "sprint");
  if (!call) throw new Error("No 'sprint' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerSprintCommand", () => {
  const baseEntry: SprintEntry = {
    projectName: "my-project",
    sprintName: "my-project Sprint",
    progressPercent: 60,
    status: "active",
    health: "on-track",
    velocityTrend: "stable",
    stories: { total: 5, done: 3, inProgress: 1, blocked: 0, backlog: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'sprint' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(async () => []);
    expect(mockBotCommand).toHaveBeenCalledWith("sprint", expect.any(Function));
  });

  it("calls provider without project name for /sprint (no args)", async () => {
    const provider = vi.fn().mockResolvedValue([baseEntry]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(provider);

    const handler = getSprintHandler();
    // Simulate /sprint with no arguments
    await handler({ reply: mockReply, message: { text: "/sprint" } });

    expect(provider).toHaveBeenCalledWith(undefined);
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Sprint Overview"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("calls provider with project name for /sprint my-project", async () => {
    const provider = vi.fn().mockResolvedValue([baseEntry]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(provider);

    const handler = getSprintHandler();
    await handler({ reply: mockReply, message: { text: "/sprint my-project" } });

    expect(provider).toHaveBeenCalledWith("my-project");
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Sprint: my"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles provider error gracefully — replies with fallback", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("SessionManager crashed"));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(provider);

    const handler = getSprintHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("SessionManager crashed"));
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Sprint unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
  });

  it("handles timeout — replies with fallback", async () => {
    const provider = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(provider);

    const handler = getSprintHandler();
    vi.useFakeTimers();
    const handlerPromise = handler({ reply: mockReply });
    await vi.advanceTimersByTimeAsync(4_000);
    await handlerPromise;

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Sprint unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fallback reply catch prevents double-throw on network failure", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("provider error"));
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSprintCommand(provider);

    const handler = getSprintHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("provider error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatHealthMessage tests (Story 57.8)
// ---------------------------------------------------------------------------

describe("formatHealthMessage", () => {
  const healthyResult: HealthCheckResult = {
    overall: "healthy",
    components: [
      { component: "Event Bus", status: "healthy", latencyMs: 12, message: "Healthy" },
      { component: "BMAD Tracker", status: "healthy", latencyMs: 5, message: "Healthy" },
      { component: "Local State", status: "healthy", latencyMs: 2, message: "Healthy" },
    ],
    timestamp: "2026-04-09T12:00:00.000Z",
    exitCode: 0,
  };

  const degradedResult: HealthCheckResult = {
    overall: "degraded",
    components: [
      { component: "Event Bus", status: "healthy", latencyMs: 12, message: "Healthy" },
      {
        component: "BMAD Tracker",
        status: "degraded",
        latencyMs: 450,
        message: "High latency",
      },
      { component: "Local State", status: "healthy", latencyMs: 2, message: "Healthy" },
    ],
    timestamp: "2026-04-09T12:00:00.000Z",
    exitCode: 0,
  };

  const unhealthyResult: HealthCheckResult = {
    overall: "unhealthy",
    components: [
      { component: "Event Bus", status: "healthy", latencyMs: 12, message: "Healthy" },
      {
        component: "BMAD Tracker",
        status: "unhealthy",
        latencyMs: 2100,
        message: "Connection refused",
        details: ["ECONNREFUSED 127.0.0.1:3000"],
      },
    ],
    timestamp: "2026-04-09T12:00:00.000Z",
    exitCode: 1,
  };

  it("shows 'All systems operational' when all healthy (compact mode)", () => {
    const msg = formatHealthMessage(healthyResult);
    expect(msg).toContain("*System Health*");
    expect(msg).toContain("All systems operational");
    expect(msg).toContain("Event Bus");
    expect(msg).toContain("BMAD Tracker");
    expect(msg).toContain("12ms");
    expect(msg).toContain("5ms");
    expect(msg).not.toContain("Degraded");
    expect(msg).not.toContain("Unhealthy");
  });

  it("shows full detail mode with warnings when degraded", () => {
    const msg = formatHealthMessage(degradedResult);
    expect(msg).toContain("*System Health*");
    expect(msg).toContain("Degraded");
    expect(msg).toContain("High latency");
    expect(msg).toContain("1 degraded component");
  });

  it("shows error details for unhealthy components", () => {
    const msg = formatHealthMessage(unhealthyResult);
    expect(msg).toContain("Unhealthy");
    expect(msg).toContain("Connection refused");
    expect(msg).toContain("ECONNREFUSED");
    expect(msg).toContain("1 unhealthy component");
  });

  it("shows 'Health check unavailable' for empty components", () => {
    const empty: HealthCheckResult = {
      overall: "healthy",
      components: [],
      timestamp: "",
      exitCode: 0,
    };
    const msg = formatHealthMessage(empty);
    expect(msg).toContain("Health check unavailable");
    expect(msg).toContain("Could not run health diagnostics");
  });

  it("escapes dynamic content in component names and messages", () => {
    const result: HealthCheckResult = {
      overall: "unhealthy",
      components: [
        {
          component: "my [service].test",
          status: "unhealthy",
          message: "Error [code]: fail.test",
          details: ["detail-with.dots"],
        },
      ],
      timestamp: "",
      exitCode: 1,
    };
    const msg = formatHealthMessage(result);
    expect(msg).toContain("my \\[service\\]\\.test");
    expect(msg).toContain("Error \\[code\\]: fail\\.test");
    expect(msg).toContain("detail\\-with\\.dots");
  });

  it("includes timestamp when provided", () => {
    const msg = formatHealthMessage(healthyResult);
    expect(msg).toContain("\u{1F552}");
    expect(msg).toContain("2026\\-04\\-09T12:00:00\\.000Z");
  });

  it("uses correct emojis per status", () => {
    const healthy = formatHealthMessage(healthyResult);
    expect(healthy).toContain("\u{1F7E2}"); // green circle

    const degraded = formatHealthMessage(degradedResult);
    expect(degraded).toContain("\u{1F7E1}"); // yellow circle

    const unhealthy = formatHealthMessage(unhealthyResult);
    expect(unhealthy).toContain("\u{1F534}"); // red circle
  });

  it("shows summary footer with session command hint", () => {
    const msg = formatHealthMessage(healthyResult);
    expect(msg).toContain("Use /status for session summary");
  });

  it("shows mixed degraded and unhealthy counts together", () => {
    const result: HealthCheckResult = {
      overall: "unhealthy",
      components: [
        { component: "A", status: "healthy", message: "ok" },
        { component: "B", status: "degraded", message: "slow" },
        { component: "C", status: "unhealthy", message: "down" },
      ],
      timestamp: "",
      exitCode: 1,
    };
    const msg = formatHealthMessage(result);
    expect(msg).toContain("1 unhealthy component, 1 degraded");
  });

  it("shows cached indicator when rateLimited is true", () => {
    const result: HealthCheckResult = {
      ...healthyResult,
      rateLimited: true,
    };
    const msg = formatHealthMessage(result);
    expect(msg).toContain("Cached result");
    expect(msg).toContain("rate limited");
  });

  it("shows cached indicator in detail mode when rateLimited is true", () => {
    const result: HealthCheckResult = {
      ...degradedResult,
      rateLimited: true,
    };
    const msg = formatHealthMessage(result);
    expect(msg).toContain("Degraded");
    expect(msg).toContain("Cached result");
    expect(msg).toContain("rate limited");
  });

  it("does not show cached indicator when rateLimited is false/undefined", () => {
    const msg = formatHealthMessage(healthyResult);
    expect(msg).not.toContain("Cached result");
  });
});

// ---------------------------------------------------------------------------
// registerHealthCommand tests (Story 57.8)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("health", fn). */
function getHealthHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "health");
  if (!call) throw new Error("No 'health' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerHealthCommand", () => {
  const baseResult: HealthCheckResult = {
    overall: "healthy",
    components: [{ component: "Event Bus", status: "healthy", latencyMs: 10, message: "Healthy" }],
    timestamp: "2026-04-09T12:00:00.000Z",
    exitCode: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'health' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerHealthCommand(async () => baseResult);
    expect(mockBotCommand).toHaveBeenCalledWith("health", expect.any(Function));
  });

  it("calls provider and replies with formatted message", async () => {
    const provider = vi.fn().mockResolvedValue(baseResult);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerHealthCommand(provider);

    const handler = getHealthHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("System Health"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles provider error gracefully — replies with fallback", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("HealthCheckService crashed"));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerHealthCommand(provider);

    const handler = getHealthHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("HealthCheckService crashed"));
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Health check unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
  });

  it("handles timeout — replies with fallback", async () => {
    const provider = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerHealthCommand(provider);

    const handler = getHealthHandler();
    vi.useFakeTimers();
    const handlerPromise = handler({ reply: mockReply });
    await vi.advanceTimersByTimeAsync(4_000);
    await handlerPromise;

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Health check unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fallback reply catch prevents double-throw on network failure", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("provider error"));
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerHealthCommand(provider);

    const handler = getHealthHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("provider error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatConflictsMessage tests (Story 57.9)
// ---------------------------------------------------------------------------

describe("formatConflictsMessage", () => {
  const criticalConflict: ConflictEntry = {
    id: "conf-1",
    resourceType: "repository",
    resourceIdentifier: "https://github.com/org/main-repo",
    competingProjects: ["api-service", "web-app"],
    severity: "critical",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  const highConflict: ConflictEntry = {
    id: "conf-2",
    resourceType: "agent",
    resourceIdentifier: "claude-code-1",
    competingProjects: ["backend", "frontend"],
    severity: "high",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  const mediumConflict: ConflictEntry = {
    id: "conf-3",
    resourceType: "file-path",
    resourceIdentifier: "src/config.yaml",
    competingProjects: ["project-a", "project-b"],
    severity: "medium",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  const lowConflict: ConflictEntry = {
    id: "conf-4",
    resourceType: "external-service",
    resourceIdentifier: "api.openai.com",
    competingProjects: ["project-c"],
    severity: "low",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  it("shows 'No active conflicts' for empty array", () => {
    const msg = formatConflictsMessage([]);
    expect(msg).toContain("No active conflicts");
    expect(msg).toContain("*Resource Conflicts*");
    expect(msg).not.toContain("critical");
  });

  it("formats multiple conflicts with severity emojis and resource rows", () => {
    const msg = formatConflictsMessage([criticalConflict, mediumConflict]);
    expect(msg).toContain("*Resource Conflicts*");
    expect(msg).toContain("2 active");
    expect(msg).toContain("\u{1F534}"); // red circle for critical
    expect(msg).toContain("\u{1F7E1}"); // yellow circle for medium
    expect(msg).toContain("\u{1F4E6}"); // 📦 for repository
    expect(msg).toContain("\u{1F4C4}"); // 📄 for file-path
    expect(msg).toContain("1 critical");
    expect(msg).toContain("1 medium");
  });

  it("uses red circle for critical severity", () => {
    const msg = formatConflictsMessage([criticalConflict]);
    expect(msg).toContain("\u{1F534}");
  });

  it("uses orange circle for high severity", () => {
    const msg = formatConflictsMessage([highConflict]);
    expect(msg).toContain("\u{1F7E0}");
  });

  it("uses yellow circle for medium severity", () => {
    const msg = formatConflictsMessage([mediumConflict]);
    expect(msg).toContain("\u{1F7E1}");
  });

  it("uses green circle for low severity", () => {
    const msg = formatConflictsMessage([lowConflict]);
    expect(msg).toContain("\u{1F7E2}");
  });

  it("uses correct resource type emojis", () => {
    const repoMsg = formatConflictsMessage([criticalConflict]);
    expect(repoMsg).toContain("\u{1F4E6}"); // 📦 repository

    const agentMsg = formatConflictsMessage([highConflict]);
    expect(agentMsg).toContain("\u{1F916}"); // 🤖 agent

    const fileMsg = formatConflictsMessage([mediumConflict]);
    expect(fileMsg).toContain("\u{1F4C4}"); // 📄 file-path

    const extMsg = formatConflictsMessage([lowConflict]);
    expect(extMsg).toContain("\u{1F310}"); // 🌐 external-service
  });

  it("escapes dynamic content in resource identifiers and project names", () => {
    const conflict: ConflictEntry = {
      id: "conf-test",
      resourceType: "repository",
      resourceIdentifier: "my-repo.test",
      competingProjects: ["project [a]"],
      severity: "critical",
      detectedAt: "2026-04-09T12:00:00.000Z",
    };
    const msg = formatConflictsMessage([conflict]);
    expect(msg).toContain("my\\-repo\\.test");
    expect(msg).toContain("project \\[a\\]");
  });

  it("shows competing projects for each conflict", () => {
    const msg = formatConflictsMessage([criticalConflict]);
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("web\\-app");
  });

  it("shows summary footer with severity counts", () => {
    const msg = formatConflictsMessage([
      criticalConflict,
      highConflict,
      mediumConflict,
      lowConflict,
    ]);
    expect(msg).toContain("1 critical");
    expect(msg).toContain("1 high");
    expect(msg).toContain("1 medium");
    expect(msg).toContain("1 low");
  });

  it("sorts conflicts by severity (critical first)", () => {
    const msg = formatConflictsMessage([lowConflict, criticalConflict]);
    const criticalPos = msg.indexOf("\u{1F534}"); // red circle
    const lowPos = msg.indexOf("\u{1F7E2}"); // green circle
    expect(criticalPos).toBeLessThan(lowPos);
  });

  it("uses question mark emoji for unknown resource types", () => {
    const conflict: ConflictEntry = {
      id: "conf-unk",
      resourceType: "custom-type",
      resourceIdentifier: "resource-1",
      competingProjects: ["project-x"],
      severity: "low",
      detectedAt: "2026-04-09T12:00:00.000Z",
    };
    const msg = formatConflictsMessage([conflict]);
    expect(msg).toContain("\u2753"); // question mark
  });

  it("shows em dash for empty competing projects", () => {
    const conflict: ConflictEntry = {
      id: "conf-empty",
      resourceType: "repository",
      resourceIdentifier: "my-repo",
      competingProjects: [],
      severity: "low",
      detectedAt: "2026-04-09T12:00:00.000Z",
    };
    const msg = formatConflictsMessage([conflict]);
    expect(msg).toContain("\u2014"); // em dash
  });

  it("truncates display when more than 20 conflicts", () => {
    const conflicts: ConflictEntry[] = Array.from({ length: 25 }, (_, i) => ({
      id: `conf-${i}`,
      resourceType: "repository" as const,
      resourceIdentifier: `repo-${i}`,
      competingProjects: ["project-a"],
      severity: "low" as const,
      detectedAt: "2026-04-09T12:00:00.000Z",
    }));
    const msg = formatConflictsMessage(conflicts);
    // Should show truncation indicator
    expect(msg).toContain("5 more conflicts");
    // Should still show the full summary footer (all 25 counted)
    expect(msg).toContain("25 low");
    // Should contain first conflict but not 21st+
    expect(msg).toContain("repo\\-0");
    expect(msg).not.toContain("repo\\-24");
  });
});

// ---------------------------------------------------------------------------
// registerConflictsCommand tests (Story 57.9)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("conflicts", fn). */
function getConflictsHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "conflicts");
  if (!call) throw new Error("No 'conflicts' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerConflictsCommand", () => {
  const baseConflict: ConflictEntry = {
    id: "conf-1",
    resourceType: "repository",
    resourceIdentifier: "main-repo",
    competingProjects: ["api-service", "web-app"],
    severity: "critical",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'conflicts' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(async () => []);
    expect(mockBotCommand).toHaveBeenCalledWith("conflicts", expect.any(Function));
  });

  it("calls provider and replies with formatted message", async () => {
    const provider = vi.fn().mockResolvedValue([baseConflict]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Resource Conflicts"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("calls provider and replies with empty message when no conflicts", async () => {
    const provider = vi.fn().mockResolvedValue([]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    await handler({ reply: mockReply });

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("No active conflicts"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles provider error gracefully — replies with fallback", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("ConflictService crashed"));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    await handler({ reply: mockReply });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ConflictService crashed"));
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Conflicts check unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
  });

  it("handles timeout — replies with fallback", async () => {
    const provider = vi.fn().mockReturnValue(new Promise(() => {}));
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    vi.useFakeTimers();
    const handlerPromise = handler({ reply: mockReply });
    await vi.advanceTimersByTimeAsync(4_000);
    await handlerPromise;

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Conflicts check unavailable"), {
      parse_mode: "MarkdownV2",
    });
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fallback reply catch prevents double-throw on network failure", async () => {
    const provider = vi.fn().mockRejectedValue(new Error("provider error"));
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    await handler({ reply: mockReply });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("provider error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// parseProjectArg tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("parseProjectArg", () => {
  it("extracts project name from project:<name> syntax", () => {
    expect(parseProjectArg("/status project:api-service")).toBe("api-service");
  });

  it("extracts project name with other args present", () => {
    expect(parseProjectArg("/fleet project:my-app other-arg")).toBe("my-app");
  });

  it("returns undefined for no match", () => {
    expect(parseProjectArg("/status")).toBeUndefined();
    expect(parseProjectArg("/conflicts")).toBeUndefined();
  });

  it("handles trailing spaces", () => {
    expect(parseProjectArg("/status project:web-app   ")).toBe("web-app");
  });

  it("handles project name with hyphens and dots", () => {
    expect(parseProjectArg("/status project:my-app.v2")).toBe("my-app.v2");
  });

  it("picks first match when multiple project: args", () => {
    expect(parseProjectArg("/status project:alpha project:beta")).toBe("alpha");
  });
});

// ---------------------------------------------------------------------------
// registerStatusCommand project context tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("registerStatusCommand project context", () => {
  const baseStatus: SystemStatus = {
    activeAgents: 1,
    totalSessions: 1,
    workingSessions: 1,
    blockedSessions: 0,
    idleSessions: 0,
    openPRs: 0,
    needsReview: 0,
    healthStatus: "healthy",
    timestamp: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes explicit project arg to provider", async () => {
    const provider = vi.fn().mockResolvedValue(baseStatus);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    await handler({
      reply: mockReply,
      message: { text: "/status project:api-service" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith("api-service");
    // Header should show scoped project name
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("api\\-service"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("falls back to default context when no explicit arg", async () => {
    const provider = vi.fn().mockResolvedValue(baseStatus);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    // Set default project context via /setproject
    bot.registerSetProjectCommand(() => ["web-app"]);
    const setProjectHandler = mockBotCommand.mock.calls.find((c) => c[0] === "setproject")![1] as (
      ...args: Array<unknown>
    ) => Promise<void>;
    await setProjectHandler({
      reply: vi.fn().mockResolvedValue(undefined),
      message: { text: "/setproject web-app" },
      chat: { id: 42 },
    });

    const handler = getStatusHandler();
    await handler({
      reply: mockReply,
      message: { text: "/status" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith("web-app");
  });

  it("explicit arg overrides default context", async () => {
    const provider = vi.fn().mockResolvedValue(baseStatus);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    // Set default context
    bot.registerSetProjectCommand(() => ["default-proj"]);
    const setProjectHandler = mockBotCommand.mock.calls.find((c) => c[0] === "setproject")![1] as (
      ...args: Array<unknown>
    ) => Promise<void>;
    await setProjectHandler({
      reply: vi.fn().mockResolvedValue(undefined),
      message: { text: "/setproject default-proj" },
      chat: { id: 42 },
    });

    const handler = getStatusHandler();
    await handler({
      reply: mockReply,
      message: { text: "/status project:override-proj" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith("override-proj");
  });

  it("passes undefined when no context and no arg", async () => {
    const provider = vi.fn().mockResolvedValue(baseStatus);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerStatusCommand(provider);

    const handler = getStatusHandler();
    await handler({
      reply: mockReply,
      message: { text: "/status" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// registerFleetCommand project context tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("registerFleetCommand project context", () => {
  const healthyAgent: FleetAgent = {
    id: "app-1",
    project: "my-project",
    status: "working",
    activity: "active",
    isAlert: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes explicit project arg to fleet provider", async () => {
    const provider = vi.fn().mockResolvedValue([healthyAgent]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerFleetCommand(provider);

    const handler = getFleetHandler();
    await handler({
      reply: mockReply,
      message: { text: "/fleet project:api-service" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith("api-service");
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("api\\-service"), {
      parse_mode: "MarkdownV2",
    });
  });
});

// ---------------------------------------------------------------------------
// registerConflictsCommand project context tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("registerConflictsCommand project context", () => {
  const baseConflict: ConflictEntry = {
    id: "conf-1",
    resourceType: "repository",
    resourceIdentifier: "main-repo",
    competingProjects: ["api-service"],
    severity: "critical",
    detectedAt: "2026-04-09T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes explicit project arg to conflicts provider", async () => {
    const provider = vi.fn().mockResolvedValue([baseConflict]);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerConflictsCommand(provider);

    const handler = getConflictsHandler();
    await handler({
      reply: mockReply,
      message: { text: "/conflicts project:api-service" },
      chat: { id: 42 },
    });

    expect(provider).toHaveBeenCalledWith("api-service");
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("api\\-service"), {
      parse_mode: "MarkdownV2",
    });
  });
});

// ---------------------------------------------------------------------------
// registerSetProjectCommand tests (Story 57.10)
// ---------------------------------------------------------------------------

/** Helper: extract the handler callback registered via bot.command("setproject", fn). */
function getSetProjectHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "setproject");
  if (!call) throw new Error("No 'setproject' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}

describe("registerSetProjectCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets context and replies with confirmation when arg provided", async () => {
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["api-service"]);

    const handler = getSetProjectHandler();
    await handler({
      reply: mockReply,
      message: { text: "/setproject api-service" },
      chat: { id: 42 },
    });

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("api\\-service"), {
      parse_mode: "MarkdownV2",
    });
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Default project"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("clears context when no arg provided", async () => {
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["api-service"]);

    // First set, then clear
    const handler = getSetProjectHandler();
    await handler({
      reply: vi.fn().mockResolvedValue(undefined),
      message: { text: "/setproject api-service" },
      chat: { id: 42 },
    });
    await handler({
      reply: mockReply,
      message: { text: "/setproject" },
      chat: { id: 42 },
    });

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("cleared"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("escapes project name in confirmation", async () => {
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["my-project.v2"]);

    const handler = getSetProjectHandler();
    await handler({
      reply: mockReply,
      message: { text: "/setproject my-project.v2" },
      chat: { id: 42 },
    });

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("my\\-project\\.v2"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("matches project name case-insensitively", async () => {
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["API Service"]);

    const handler = getSetProjectHandler();
    await handler({
      reply: mockReply,
      message: { text: "/setproject api service" },
      chat: { id: 42 },
    });

    // Should match and store the canonical name "API Service"
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("API Service"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("rejects invalid project name with available projects list", async () => {
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["API Service", "Web App"]);

    const handler = getSetProjectHandler();
    await handler({
      reply: mockReply,
      message: { text: "/setproject nonexistent" },
      chat: { id: 42 },
    });

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("not found"), {
      parse_mode: "MarkdownV2",
    });
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("API Service"), {
      parse_mode: "MarkdownV2",
    });
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("Web App"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("handles reply error gracefully", async () => {
    const mockReply = vi.fn().mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSetProjectCommand(() => ["api-service"]);

    const handler = getSetProjectHandler();
    await handler({
      reply: mockReply,
      message: { text: "/setproject api-service" },
      chat: { id: 42 },
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("setproject command error"));
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatStatusMessage with projectName tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("formatStatusMessage with projectName", () => {
  const baseStatus: SystemStatus = {
    activeAgents: 1,
    totalSessions: 1,
    workingSessions: 1,
    blockedSessions: 0,
    idleSessions: 0,
    openPRs: 0,
    needsReview: 0,
    healthStatus: "healthy",
    timestamp: "",
  };

  it("shows scoped header with project name", () => {
    const msg = formatStatusMessage(baseStatus, "api-service");
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("Agent Orchestrator Status");
  });

  it("escapes special chars in project name", () => {
    const msg = formatStatusMessage(baseStatus, "my [project].test");
    expect(msg).toContain("my \\[project\\]\\.test");
  });

  it("omits project suffix when projectName is undefined", () => {
    const msg = formatStatusMessage(baseStatus);
    expect(msg).not.toContain("\\(");
    expect(msg).toContain("Agent Orchestrator Status");
  });
});

// ---------------------------------------------------------------------------
// formatFleetMessage with projectName tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("formatFleetMessage with projectName", () => {
  const agent: FleetAgent = {
    id: "app-1",
    project: "my-project",
    status: "working",
    activity: "active",
    isAlert: false,
  };

  it("shows scoped header with project name", () => {
    const msg = formatFleetMessage([agent], "api-service");
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("Agent Fleet");
  });

  it("escapes special chars in project name", () => {
    const msg = formatFleetMessage([agent], "my-app.v2");
    expect(msg).toContain("my\\-app\\.v2");
  });

  it("shows scoped header in empty message", () => {
    const msg = formatFleetMessage([], "web-app");
    expect(msg).toContain("web\\-app");
  });
});

// ---------------------------------------------------------------------------
// formatConflictsMessage with projectName tests (Story 57.10)
// ---------------------------------------------------------------------------

describe("formatConflictsMessage with projectName", () => {
  it("shows scoped header with project name when conflicts exist", () => {
    const conflict: ConflictEntry = {
      id: "conf-1",
      resourceType: "repository",
      resourceIdentifier: "main-repo",
      competingProjects: ["api-service"],
      severity: "critical",
      detectedAt: "2026-04-09T12:00:00.000Z",
    };
    const msg = formatConflictsMessage([conflict], "api-service");
    expect(msg).toContain("api\\-service");
    expect(msg).toContain("Resource Conflicts");
  });

  it("shows scoped header in no-conflicts message", () => {
    const msg = formatConflictsMessage([], "web-app");
    expect(msg).toContain("web\\-app");
    expect(msg).toContain("No active conflicts");
  });

  it("escapes special chars in project name", () => {
    const msg = formatConflictsMessage([], "my [proj].test");
    expect(msg).toContain("my \\[proj\\]\\.test");
  });
});

// ---------------------------------------------------------------------------
// Callback data encoding/decoding (Story 57.11)
// ---------------------------------------------------------------------------

describe("encodeCallbackData / decodeCallbackData", () => {
  it("round-trips action and targetId", () => {
    const encoded = encodeCallbackData("resume", "agent-1");
    const decoded = decodeCallbackData(encoded);
    expect(decoded).toEqual({ action: "resume", targetId: "agent-1" });
  });

  it("round-trips with optional eventId", () => {
    const encoded = encodeCallbackData("dismiss", "conf-1", "evt-42");
    const decoded = decodeCallbackData(encoded);
    expect(decoded).toEqual({ action: "dismiss", targetId: "conf-1", eventId: "evt-42" });
  });

  it("encodes without eventId when not provided", () => {
    const encoded = encodeCallbackData("view", "target-x");
    expect(encoded).not.toContain('"e"');
  });

  it("throws when encoded data exceeds 64 UTF-8 bytes", () => {
    const longId = "a".repeat(60);
    expect(() => encodeCallbackData("resume", longId)).toThrow(/exceeds 64 bytes/);
  });

  it("counts UTF-8 bytes, not string length", () => {
    // "ü" is 1 code unit but 2 UTF-8 bytes — 30 of these = 60 bytes + overhead > 64
    const longUtf8 = "\u00FC".repeat(30);
    expect(() => encodeCallbackData("resume", longUtf8)).toThrow(/exceeds 64 bytes/);
  });

  it("decodeCallbackData returns undefined for invalid JSON", () => {
    expect(decodeCallbackData("not-json")).toBeUndefined();
  });

  it("decodeCallbackData returns undefined when required fields missing", () => {
    expect(decodeCallbackData('{"a":"resume"}')).toBeUndefined();
    expect(decodeCallbackData('{"t":"agent-1"}')).toBeUndefined();
  });

  it("produces data under 64 bytes for typical values", () => {
    const encoded = encodeCallbackData("resume", "agent-42");
    expect(encoded.length).toBeLessThanOrEqual(64);
  });
});

// ---------------------------------------------------------------------------
// buildNotificationButtons (Story 57.11)
// ---------------------------------------------------------------------------

describe("buildNotificationButtons", () => {
  const baseUrl = "http://localhost:3000";

  it("returns 3 buttons for agent.blocked with dashboard URL", () => {
    const buttons = buildNotificationButtons("agent.blocked", { agentId: "agent-1" }, baseUrl);
    expect(buttons).toBeDefined();
    expect(buttons!.length).toBe(1);
    expect(buttons![0].length).toBe(3);
    expect(buttons![0][0].text).toBe("Resume");
    expect(buttons![0][0].callback_data).toBeDefined();
    expect(buttons![0][1].text).toBe("View Details");
    expect(buttons![0][1].url).toBe(`${baseUrl}/agents/agent-1`);
    expect(buttons![0][2].text).toBe("Dismiss");
    expect(buttons![0][2].callback_data).toBeDefined();
  });

  it("returns 2 buttons for agent.blocked without dashboard URL (no View button)", () => {
    const buttons = buildNotificationButtons("agent.blocked", { agentId: "agent-1" });
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(2);
    expect(buttons![0][0].text).toBe("Resume");
    expect(buttons![0][1].text).toBe("Dismiss");
    // No View Details button when no dashboardBaseUrl
  });

  it("returns 2 buttons for story.blocked with storyId in URL", () => {
    const buttons = buildNotificationButtons(
      "story.blocked",
      { storyId: "story-42", sessionId: "sess-1" },
      baseUrl,
    );
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(2);
    expect(buttons![0][0].text).toBe("View Details");
    expect(buttons![0][0].url).toBe(`${baseUrl}/stories/story-42`);
    expect(buttons![0][1].text).toBe("Dismiss");
    expect(buttons![0][1].callback_data).toBeDefined();
  });

  it("falls back to sessionId for storyId in story.blocked URL", () => {
    const buttons = buildNotificationButtons("story.blocked", { sessionId: "sess-1" }, baseUrl);
    expect(buttons![0][0].url).toBe(`${baseUrl}/stories/sess-1`);
  });

  it("returns 2 buttons for conflict.detected with URL button (not callback_data)", () => {
    const buttons = buildNotificationButtons(
      "conflict.detected",
      { conflictId: "conf-1" },
      baseUrl,
    );
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(2);
    expect(buttons![0][0].text).toBe("View Conflicts");
    expect(buttons![0][0].url).toBe(`${baseUrl}/conflicts/conf-1`);
    expect(buttons![0][0].callback_data).toBeUndefined();
    expect(buttons![0][1].text).toBe("Dismiss");
    expect(buttons![0][1].callback_data).toBeDefined();
  });

  it("returns 1 button for conflict.detected without dashboard URL", () => {
    const buttons = buildNotificationButtons("conflict.detected", { conflictId: "conf-1" });
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(1);
    expect(buttons![0][0].text).toBe("Dismiss");
  });

  it("returns undefined for unknown event type", () => {
    expect(buildNotificationButtons("unknown.event", {})).toBeUndefined();
  });

  it("uses agentId for callback data in agent.blocked", () => {
    const buttons = buildNotificationButtons("agent.blocked", { agentId: "my-agent" }, baseUrl);
    const resumeData = buttons![0][0].callback_data!;
    const decoded = decodeCallbackData(resumeData);
    expect(decoded?.targetId).toBe("my-agent");
  });

  it("handles empty metadata gracefully", () => {
    const buttons = buildNotificationButtons("agent.blocked", {}, baseUrl);
    expect(buttons).toBeDefined();
    // With empty metadata, targetId="" and sessionId="" → empty strings used
    expect(buttons![0][0].callback_data).toBeDefined();
  });

  it("handles empty metadata for story.blocked", () => {
    const buttons = buildNotificationButtons("story.blocked", {}, baseUrl);
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(2);
  });

  it("handles empty metadata for conflict.detected", () => {
    const buttons = buildNotificationButtons("conflict.detected", {}, baseUrl);
    expect(buttons).toBeDefined();
    expect(buttons![0].length).toBe(2);
  });

  it("strips trailing slashes from dashboardBaseUrl", () => {
    const buttons = buildNotificationButtons(
      "agent.blocked",
      { agentId: "a1" },
      "http://localhost:3000/",
    );
    expect(buttons![0][1].url).toBe("http://localhost:3000/agents/a1");
  });
});

// ---------------------------------------------------------------------------
// registerCallbackHandler (Story 57.11)
// ---------------------------------------------------------------------------

describe("registerCallbackHandler", () => {
  let bot: TelegramBot;
  let mockAnswerCallbackQuery: ReturnType<typeof vi.fn>;
  let mockEditMessageText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = new TelegramBot({ botToken: "test-token" });
    mockAnswerCallbackQuery = vi.fn().mockResolvedValue(undefined);
    mockEditMessageText = vi.fn().mockResolvedValue(undefined);
  });

  function getCallbackHandler(): (...args: Array<unknown>) => Promise<void> {
    const call = mockBotCallbackQuery.mock.calls[0];
    if (!call) throw new Error("No callback query handler registered");
    // callbackQuery(/filter/, handler) — handler is second arg
    return (call[1] ?? call[0]) as (...args: Array<unknown>) => Promise<void>;
  }

  function makeCtx(data: string, queryId = "query-1") {
    return {
      callbackQuery: {
        data,
        id: queryId,
        from: { id: 12345, username: "testuser", first_name: "Test" },
      },
      answerCallbackQuery: mockAnswerCallbackQuery,
      editMessageText: mockEditMessageText,
    };
  }

  it("registers a callbackQuery handler on the bot", () => {
    const resumeHandler = vi.fn().mockResolvedValue("OK");
    bot.registerCallbackHandler({ resume: resumeHandler });
    expect(mockBotCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("processes callback and edits message", async () => {
    const resumeHandler = vi.fn().mockResolvedValue("Agent agent-1 resumed");
    bot.registerCallbackHandler({ resume: resumeHandler });

    const handler = getCallbackHandler();
    const data = encodeCallbackData("resume", "agent-1");
    await handler(makeCtx(data));

    expect(resumeHandler).toHaveBeenCalledWith("agent-1", undefined, {
      id: 12345,
      username: "testuser",
      firstName: "Test",
    });
    expect(mockEditMessageText).toHaveBeenCalledTimes(1);
    expect(mockAnswerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("calls answerCallbackQuery even when handler throws", async () => {
    const resumeHandler = vi.fn().mockRejectedValue(new Error("fail"));
    bot.registerCallbackHandler({ resume: resumeHandler });

    const handler = getCallbackHandler();
    const data = encodeCallbackData("resume", "agent-1");
    await handler(makeCtx(data));

    expect(mockAnswerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(mockEditMessageText).toHaveBeenCalledWith(expect.stringContaining("Action failed"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("returns Already processed for duplicate callback ID", async () => {
    const resumeHandler = vi.fn().mockResolvedValue("OK");
    bot.registerCallbackHandler({ resume: resumeHandler });

    const handler = getCallbackHandler();
    const data = encodeCallbackData("resume", "agent-1");
    const ctx = makeCtx(data, "query-dup");

    // First call — processed
    await handler(ctx);
    expect(resumeHandler).toHaveBeenCalledTimes(1);

    // Second call — idempotent rejection (answered early, not again in finally)
    mockAnswerCallbackQuery.mockClear();
    await handler(ctx);
    expect(resumeHandler).toHaveBeenCalledTimes(1); // NOT called again
    expect(mockAnswerCallbackQuery).toHaveBeenCalledTimes(1); // Only the early-return call, not double
    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith({ text: "Already processed" });
  });

  it("caps processedCallbacks at 1000 entries", async () => {
    const dismissHandler = vi.fn().mockResolvedValue("Acknowledged");
    bot.registerCallbackHandler({ dismiss: dismissHandler });

    const handler = getCallbackHandler();
    const data = encodeCallbackData("dismiss", "t-1");

    // Process 1000 callbacks with unique IDs
    for (let i = 0; i < 1001; i++) {
      await handler(makeCtx(data, `q-${i}`));
    }

    // The first callback should have been evicted — process it again and it should succeed
    mockAnswerCallbackQuery.mockClear();
    dismissHandler.mockClear();
    await handler(makeCtx(data, "q-0"));
    expect(dismissHandler).toHaveBeenCalledTimes(1);
  });

  it("handles decode failure gracefully", async () => {
    bot.registerCallbackHandler({});

    const handler = getCallbackHandler();
    await handler(makeCtx("not-valid-json"));

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith({ text: "Unknown action" });
    expect(mockEditMessageText).not.toHaveBeenCalled();
  });

  it("handles unknown action gracefully", async () => {
    bot.registerCallbackHandler({});

    const handler = getCallbackHandler();
    const data = encodeCallbackData("resume", "agent-1");
    await handler(makeCtx(data));

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith({ text: "Unknown action" });
  });

  it("passes eventId to handler when present", async () => {
    const dismissHandler = vi.fn().mockResolvedValue("Acknowledged");
    bot.registerCallbackHandler({ dismiss: dismissHandler });

    const handler = getCallbackHandler();
    const data = encodeCallbackData("dismiss", "agent-1", "evt-42");
    await handler(makeCtx(data));

    expect(dismissHandler).toHaveBeenCalledWith("agent-1", "evt-42", {
      id: 12345,
      username: "testuser",
      firstName: "Test",
    });
  });
});

// ---------------------------------------------------------------------------
// Approval buttons and messages (Story 57.12)
// ---------------------------------------------------------------------------

describe("buildApprovalButtons", () => {
  it("returns Approve and Deny buttons with valid callback data", () => {
    const approvalId = "550e8400-e29b-41d4-a716-446655440000";
    const buttons = buildApprovalButtons(approvalId)!;
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveLength(2);
    expect(buttons[0][0].text).toBe("Approve");
    expect(buttons[0][1].text).toBe("Deny");
    expect(buttons[0][0].callback_data).toBeDefined();
    expect(buttons[0][1].callback_data).toBeDefined();
  });

  it("callback data decodes correctly with approve action", () => {
    const approvalId = "550e8400-e29b-41d4-a716-446655440000";
    const buttons = buildApprovalButtons(approvalId)!;
    const decoded = decodeCallbackData(buttons[0][0].callback_data!);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("approve");
    expect(decoded!.targetId).toBe(approvalId);
  });

  it("callback data decodes correctly with deny action", () => {
    const approvalId = "550e8400-e29b-41d4-a716-446655440000";
    const buttons = buildApprovalButtons(approvalId)!;
    const decoded = decodeCallbackData(buttons[0][1].callback_data!);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("deny");
    expect(decoded!.targetId).toBe(approvalId);
  });

  it("callback data stays under 64 bytes for UUID approval ID", () => {
    const approvalId = "550e8400-e29b-41d4-a716-446655440000";
    const buttons = buildApprovalButtons(approvalId)!;
    for (const btn of buttons[0]) {
      const bytes = new TextEncoder().encode(btn.callback_data!).length;
      expect(bytes).toBeLessThanOrEqual(64);
    }
  });
});

describe("formatApprovalMessage", () => {
  it("formats message with all fields", () => {
    const msg = formatApprovalMessage({
      action: "spawn",
      target: "agent-1",
      requestedBy: "autopilot",
      requestedAt: "2026-04-10T12:00:00.000Z",
    });
    expect(msg).toContain("Approval Request");
    expect(msg).toContain("spawn");
    expect(msg).toContain("agent\\-1");
    expect(msg).toContain("autopilot");
    expect(msg).toContain("2026");
  });

  it("escapes dynamic content with MarkdownV2", () => {
    const msg = formatApprovalMessage({
      action: "spawn-agent",
      target: "agent.test",
      requestedBy: "user_name",
      requestedAt: "2026-04-10T12:00:00.000Z",
    });
    // Dots and hyphens should be escaped in MarkdownV2
    expect(msg).toContain("agent\\.test");
    expect(msg).toContain("spawn\\-agent");
  });
});

describe("CallbackAction approval/deny round-trip", () => {
  it("encode/decode round-trip for approve action", () => {
    const data = encodeCallbackData("approve", "approval-123");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("approve");
    expect(decoded!.targetId).toBe("approval-123");
  });

  it("encode/decode round-trip for deny action", () => {
    const data = encodeCallbackData("deny", "approval-456");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("deny");
    expect(decoded!.targetId).toBe("approval-456");
  });
});

describe("sendApprovalMessage", () => {
  let bot: TelegramBot;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = new TelegramBot({ botToken: "test-token" });
    mockSendMessage.mockResolvedValue({ message_id: 42 });
  });

  it("sends message with inline keyboard for pending approval", async () => {
    await bot.sendApprovalMessage("12345", {
      id: "approval-uuid-1",
      action: "spawn",
      target: "agent-1",
      requestedBy: "autopilot",
      requestedAt: "2026-04-10T12:00:00.000Z",
      status: "pending",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    expect(call[0]).toBe("12345");
    const opts = call[2] as Record<string, unknown>;
    expect(opts.parse_mode).toBe("MarkdownV2");
    const replyMarkup = opts.reply_markup as { inline_keyboard: unknown[][] };
    expect(replyMarkup.inline_keyboard).toBeDefined();
    expect(replyMarkup.inline_keyboard[0]).toHaveLength(2);
  });

  it("skips sending for non-pending approval", async () => {
    await bot.sendApprovalMessage("12345", {
      id: "approval-uuid-1",
      action: "spawn",
      target: "agent-1",
      requestedBy: "autopilot",
      requestedAt: "2026-04-10T12:00:00.000Z",
      status: "approved",
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Story action buttons and messages (Story 57.13)
// ---------------------------------------------------------------------------

describe("CallbackAction story action round-trips (Story 57.13)", () => {
  it("encode/decode round-trip for block action", () => {
    const data = encodeCallbackData("block", "49-1-portfolio-dashboard");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("block");
    expect(decoded!.targetId).toBe("49-1-portfolio-dashboard");
  });

  it("encode/decode round-trip for unblock action", () => {
    const data = encodeCallbackData("unblock", "49-1-portfolio-dashboard");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("unblock");
    expect(decoded!.targetId).toBe("49-1-portfolio-dashboard");
  });

  it("encode/decode round-trip for priority action with param in targetId", () => {
    const data = encodeCallbackData("priority", "49-1-portfolio-dashboard:high");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("priority");
    expect(decoded!.targetId).toBe("49-1-portfolio-dashboard:high");
  });

  it("encode/decode round-trip for assign action with param in targetId", () => {
    const data = encodeCallbackData("assign", "49-1-portfolio-dashboard:agent-1");
    const decoded = decodeCallbackData(data);
    expect(decoded).toBeDefined();
    expect(decoded!.action).toBe("assign");
    expect(decoded!.targetId).toBe("49-1-portfolio-dashboard:agent-1");
  });

  it("story action callback data stays under 64 bytes", () => {
    const cases = [
      encodeCallbackData("block", "49-1-portfolio-dashboard"),
      encodeCallbackData("unblock", "49-1-portfolio-dashboard"),
      encodeCallbackData("priority", "49-1-portfolio-dashboard:high"),
      encodeCallbackData("assign", "49-1-portfolio-dashboard:agent-1"),
    ];
    for (const data of cases) {
      const bytes = new TextEncoder().encode(data).length;
      expect(bytes).toBeLessThanOrEqual(64);
    }
  });
});

describe("buildStoryActionButtons", () => {
  it("returns Block, Priority, Assign buttons with valid callback data", () => {
    const buttons = buildStoryActionButtons("49-1-portfolio-dashboard", "my-project");
    expect(buttons).toHaveLength(1);
    expect(buttons![0]).toHaveLength(3);
    expect(buttons![0][0].text).toBe("Block");
    expect(buttons![0][1].text).toBe("Priority");
    expect(buttons![0][2].text).toBe("Assign");
    // Verify callback_data decodes correctly
    const blockDecoded = decodeCallbackData(buttons![0][0].callback_data!);
    expect(blockDecoded!.action).toBe("block");
    expect(blockDecoded!.targetId).toBe("49-1-portfolio-dashboard");
    const priorityDecoded = decodeCallbackData(buttons![0][1].callback_data!);
    expect(priorityDecoded!.action).toBe("priority");
    expect(priorityDecoded!.targetId).toBe("49-1-portfolio-dashboard");
    const assignDecoded = decodeCallbackData(buttons![0][2].callback_data!);
    expect(assignDecoded!.action).toBe("assign");
    expect(assignDecoded!.targetId).toBe("49-1-portfolio-dashboard");
  });

  it("returns undefined for empty storyId", () => {
    expect(buildStoryActionButtons("", "my-project")).toBeUndefined();
  });

  it("returns undefined when callback data would exceed 64 bytes", () => {
    const longId = "a".repeat(55);
    expect(buildStoryActionButtons(longId, "project")).toBeUndefined();
  });

  it("all button callback data stays under 64 bytes", () => {
    const buttons = buildStoryActionButtons("49-1-portfolio-dashboard", "my-project");
    for (const row of buttons!) {
      for (const btn of row) {
        if (btn.callback_data) {
          const bytes = new TextEncoder().encode(btn.callback_data).length;
          expect(bytes).toBeLessThanOrEqual(64);
        }
      }
    }
  });

  it("shows Unblock button when isBlocked option is true", () => {
    const buttons = buildStoryActionButtons("49-1-portfolio", "my-project", undefined, {
      isBlocked: true,
    });
    expect(buttons).toHaveLength(1);
    expect(buttons![0][0].text).toBe("Unblock");
    const decoded = decodeCallbackData(buttons![0][0].callback_data!);
    expect(decoded!.action).toBe("unblock");
    expect(decoded!.targetId).toBe("49-1-portfolio");
  });

  it("shows Block button when isBlocked option is false or omitted", () => {
    const buttonsFalse = buildStoryActionButtons("49-1-portfolio", "p", undefined, {
      isBlocked: false,
    });
    expect(buttonsFalse![0][0].text).toBe("Block");
    const decodedFalse = decodeCallbackData(buttonsFalse![0][0].callback_data!);
    expect(decodedFalse!.action).toBe("block");

    const buttonsDefault = buildStoryActionButtons("49-1-portfolio", "p");
    expect(buttonsDefault![0][0].text).toBe("Block");
  });
});

describe("formatStoryActionMessage", () => {
  it("escapes dynamic content with MarkdownV2", () => {
    const msg = formatStoryActionMessage(
      "49-1-portfolio.test",
      "my [project]",
      "blocked",
      "Story updated",
    );
    expect(msg).toContain("49\\-1\\-portfolio\\.test");
    expect(msg).toContain("my \\[project\\]");
  });

  it("includes action and result in output", () => {
    const msg = formatStoryActionMessage(
      "49-1-story",
      "my-project",
      "priority",
      "Priority set to high",
    );
    expect(msg).toContain("priority");
    expect(msg).toContain("Priority set to high");
  });
});

// ---------------------------------------------------------------------------
// registerCancelCommand (Story 57.14)
// ---------------------------------------------------------------------------

describe("registerCancelCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'cancel' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerCancelCommand();
    expect(mockBotCommand).toHaveBeenCalledWith("cancel", expect.any(Function));
  });

  it("cancel handler exits active conversation and sends cancelled message", async () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerCancelCommand();

    const calls = mockBotCommand.mock.calls as Array<[string, unknown]>;
    const handler = calls.find((c) => c[0] === "cancel")?.[1] as (ctx: unknown) => Promise<void>;

    const mockExit = vi.fn().mockResolvedValue(undefined);
    const mockReply = vi.fn().mockResolvedValue(undefined);
    const mockCtx = {
      conversation: {
        active: vi.fn().mockResolvedValue(true),
        exit: mockExit,
      },
      reply: mockReply,
    };

    await handler(mockCtx);

    expect(mockCtx.conversation.active).toHaveBeenCalledWith("spawn");
    expect(mockExit).toHaveBeenCalledWith("spawn");
    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("cancelled"), {
      parse_mode: "MarkdownV2",
    });
  });

  it("cancel handler sends 'no active conversation' when none active", async () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerCancelCommand();

    const calls = mockBotCommand.mock.calls as Array<[string, unknown]>;
    const handler = calls.find((c) => c[0] === "cancel")?.[1] as (ctx: unknown) => Promise<void>;

    const mockReply = vi.fn().mockResolvedValue(undefined);
    const mockCtx = {
      conversation: {
        active: vi.fn().mockResolvedValue(false),
        exit: vi.fn(),
      },
      reply: mockReply,
    };

    await handler(mockCtx);

    expect(mockReply).toHaveBeenCalledWith(expect.stringContaining("No active"), {
      parse_mode: "MarkdownV2",
    });
  });
});

// ---------------------------------------------------------------------------
// registerSpawnCommand (Story 57.14)
// ---------------------------------------------------------------------------

describe("registerSpawnCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'spawn' command handler on the bot", () => {
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSpawnCommand(
      () => ["project-a"],
      () => [],
    );
    expect(mockBotCommand).toHaveBeenCalledWith("spawn", expect.any(Function));
  });

  it("registers conversation middleware via bot.use", () => {
    const bot = new TelegramBot({ botToken: "token" });
    // Constructor calls use() twice (session + conversations); clear those
    mockBotUse.mockClear();
    bot.registerSpawnCommand(
      () => [],
      () => [],
    );
    // createConversation registers another middleware via use()
    expect(mockBotUse).toHaveBeenCalled();
  });
});
