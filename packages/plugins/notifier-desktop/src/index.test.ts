import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import type {
  OrchestratorEvent,
  NotifyAction,
  Notification,
  NotificationPlugin,
} from "@composio/ao-core";

// Mock node:child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// Mock node:os
vi.mock("node:os", () => ({
  platform: vi.fn(() => "darwin"),
}));

// Mock node-notifier - use factory to avoid hoisting issues
vi.mock("node-notifier", () => ({
  default: {
    notify: vi.fn(),
  },
}));

import { execFile } from "node:child_process";
import { platform } from "node:os";
import nodeNotifier from "node-notifier";
import { manifest, create, escapeAppleScript } from "./index.js";

const mockExecFile = execFile as unknown as Mock;
const mockPlatform = platform as unknown as Mock;
const mockNotify = nodeNotifier.notify as unknown as Mock;

function makeEvent(overrides: Partial<OrchestratorEvent> = {}): OrchestratorEvent {
  return {
    id: "evt-1",
    type: "session.spawned",
    priority: "info",
    sessionId: "app-1",
    projectId: "my-project",
    timestamp: new Date("2025-01-01T00:00:00Z"),
    message: "Session app-1 spawned",
    data: {},
    ...overrides,
  };
}

describe("notifier-desktop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
        cb(null);
      },
    );
  });

  describe("manifest", () => {
    it("has correct metadata", () => {
      expect(manifest.name).toBe("desktop");
      expect(manifest.slot).toBe("notifier");
      expect(manifest.version).toBe("0.1.0");
    });
  });

  describe("escapeAppleScript", () => {
    it("escapes double quotes", () => {
      expect(escapeAppleScript('hello "world"')).toBe('hello \\"world\\"');
    });

    it("escapes backslashes", () => {
      expect(escapeAppleScript("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("escapes both backslashes and quotes", () => {
      expect(escapeAppleScript('say \\"hi\\"')).toBe('say \\\\\\"hi\\\\\\"');
    });

    it("returns plain strings unchanged", () => {
      expect(escapeAppleScript("hello world")).toBe("hello world");
    });
  });

  describe("create", () => {
    it("returns a notifier with name 'desktop'", () => {
      const notifier = create();
      expect(notifier.name).toBe("desktop");
    });

    it("has notify and notifyWithActions methods", () => {
      const notifier = create();
      expect(typeof notifier.notify).toBe("function");
      expect(typeof notifier.notifyWithActions).toBe("function");
    });
  });

  describe("notify", () => {
    it("calls osascript on macOS", async () => {
      const notifier = create();
      await notifier.notify(makeEvent());

      expect(mockExecFile).toHaveBeenCalledOnce();
      expect(mockExecFile.mock.calls[0][0]).toBe("osascript");
      expect(mockExecFile.mock.calls[0][1][0]).toBe("-e");
    });

    it("includes session ID in title", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ sessionId: "backend-5" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain("backend-5");
    });

    it("includes event message in notification body", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ message: "CI is failing" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain("CI is failing");
    });

    it("uses URGENT prefix for urgent priority", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain("URGENT");
    });

    it("uses 'Agent Orchestrator' prefix for non-urgent priority", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "action" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain("Agent Orchestrator");
    });

    it("includes sound for urgent notifications", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('sound name "default"');
    });

    it("does not include sound for info notifications", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "info" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain("sound name");
    });

    it("does not include sound for action notifications", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "action" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain("sound name");
    });

    it("does not include sound for warning notifications", async () => {
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "warning" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain("sound name");
    });

    it("respects sound=false config even for urgent", async () => {
      const notifier = create({ sound: false });
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain("sound name");
    });

    it("escapes special characters in title and message", async () => {
      const notifier = create();
      await notifier.notify(
        makeEvent({ sessionId: 'test"inject', message: 'msg with "quotes" and \\backslash' }),
      );

      const script = mockExecFile.mock.calls[0][1][1] as string;
      // Should not contain unescaped quotes (other than the AppleScript string delimiters)
      expect(script).toContain('test\\"inject');
      expect(script).toContain('\\"quotes\\"');
      expect(script).toContain("\\\\backslash");
    });
  });

  describe("notify on Linux", () => {
    it("calls notify-send on Linux", async () => {
      mockPlatform.mockReturnValue("linux");
      const notifier = create();
      await notifier.notify(makeEvent());

      expect(mockExecFile).toHaveBeenCalledOnce();
      expect(mockExecFile.mock.calls[0][0]).toBe("notify-send");
    });

    it("includes --urgency=critical for urgent on Linux", async () => {
      mockPlatform.mockReturnValue("linux");
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).toContain("--urgency=critical");
      // Options must come before title/message for notify-send
      const urgencyIdx = args.indexOf("--urgency=critical");
      const titleIdx = args.findIndex((a: string) => a.includes("URGENT"));
      expect(urgencyIdx).toBeLessThan(titleIdx);
    });

    it("includes --urgency=critical for urgent even when sound is disabled", async () => {
      mockPlatform.mockReturnValue("linux");
      const notifier = create({ sound: false });
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).toContain("--urgency=critical");
    });

    it("does not include --urgency=critical for info on Linux", async () => {
      mockPlatform.mockReturnValue("linux");
      const notifier = create();
      await notifier.notify(makeEvent({ priority: "info" }));

      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).not.toContain("--urgency=critical");
    });
  });

  describe("notify on unsupported platform", () => {
    it("resolves without error on unsupported platform", async () => {
      mockPlatform.mockReturnValue("win32");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const notifier = create();
      await expect(notifier.notify(makeEvent())).resolves.toBeUndefined();
      expect(mockExecFile).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not supported on win32"));
      warnSpy.mockRestore();
    });
  });

  describe("notifyWithActions", () => {
    it("includes action labels in the message", async () => {
      const notifier = create();
      const actions: NotifyAction[] = [
        { label: "Merge", url: "https://github.com/pr/1" },
        { label: "Kill", callbackEndpoint: "/api/kill" },
      ];
      await notifier.notifyWithActions!(makeEvent(), actions);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain("Merge");
      expect(script).toContain("Kill");
    });

    it("includes sound for urgent with actions", async () => {
      const notifier = create();
      const actions: NotifyAction[] = [{ label: "Fix", url: "https://example.com" }];
      await notifier.notifyWithActions!(makeEvent({ priority: "urgent" }), actions);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('sound name "default"');
    });
  });

  describe("error handling", () => {
    it("rejects when execFile fails", async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(new Error("osascript not found"));
        },
      );
      const notifier = create();
      await expect(notifier.notify(makeEvent())).rejects.toThrow("osascript not found");
    });
  });

  // =============================================================================
  // NOTIFICATION PLUGIN INTERFACE (Story 3.2)
  // =============================================================================

  describe("NotificationPlugin interface (Story 3.2)", () => {
    let plugin: NotificationPlugin;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockPlatform.mockReturnValue("darwin");
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
        },
      );
      mockNotify.mockImplementation(
        (_options: unknown, callback: (error: Error | null, response?: unknown) => void) => {
          callback(null, {}); // Success - no error
        },
      );

      // Import dynamically to use mocked node-notifier
      const { createNotificationPlugin } = await import("./index.js");
      plugin = createNotificationPlugin();
    });

    describe("createNotificationPlugin", () => {
      it("returns a NotificationPlugin with name 'desktop'", () => {
        expect(plugin.name).toBe("desktop");
      });

      it("has send and isAvailable methods", () => {
        expect(typeof plugin.send).toBe("function");
        expect(typeof plugin.isAvailable).toBe("function");
      });
    });

    describe("isAvailable", () => {
      it("returns true when node-notifier is available", async () => {
        const available = await plugin.isAvailable();
        expect(available).toBe(true);
      });

      it("returns true even on platforms without native notifications", async () => {
        mockPlatform.mockReturnValue("win32");
        const { createNotificationPlugin } = await import("./index.js");
        const winPlugin = createNotificationPlugin();

        const available = await winPlugin.isAvailable();
        expect(available).toBe(true); // node-notifier works on Windows
      });
    });

    describe("send", () => {
      function makeNotification(overrides: Partial<Notification> = {}): Notification {
        return {
          eventId: "evt-1",
          eventType: "agent.blocked",
          priority: "critical",
          title: "Agent Blocked",
          message: "Story 3.2 agent is blocked",
          timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
          ...overrides,
        };
      }

      it("calls node-notifier.notify with correct options", async () => {
        const notification = makeNotification();
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
        const callArgs = mockNotify.mock.calls[0][0];
        expect(callArgs).toHaveProperty("title", "Agent Blocked");
        expect(callArgs).toHaveProperty("message", "Story 3.2 agent is blocked");
      });

      it("maps priority critical to urgency level", async () => {
        const notification = makeNotification({ priority: "critical" });
        await plugin.send(notification);

        const callArgs = mockNotify.mock.calls[0][0];
        expect(callArgs).toHaveProperty("sound", true); // Critical has sound
      });

      it("maps priority warning to appropriate notification", async () => {
        const notification = makeNotification({
          priority: "warning",
          title: "Warning",
          message: "Test warning",
        });
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
        const callArgs = mockNotify.mock.calls[0][0];
        expect(callArgs.title).toBe("Warning");
        expect(callArgs.message).toBe("Test warning");
      });

      it("maps priority info to appropriate notification", async () => {
        const notification = makeNotification({
          priority: "info",
          title: "Info",
          message: "Test info",
        });
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
        const callArgs = mockNotify.mock.calls[0][0];
        expect(callArgs.title).toBe("Info");
        expect(callArgs.message).toBe("Test info");
      });

      it("includes actionUrl when present", async () => {
        const notification = makeNotification({
          actionUrl: "https://github.com/pr/1",
        });
        await plugin.send(notification);

        const callArgs = mockNotify.mock.calls[0][0];
        expect(callArgs).toHaveProperty("message");
      });

      it("handles notification errors gracefully", async () => {
        mockNotify.mockImplementation(
          (_options: unknown, callback: (error: Error | null, response?: unknown) => void) => {
            callback(new Error("Notification failed"), {});
          },
        );

        const notification = makeNotification();
        // Should not throw, errors are logged but not propagated
        await expect(plugin.send(notification)).resolves.toBeUndefined();
      });

      it("works on Windows", async () => {
        mockPlatform.mockReturnValue("win32");
        const { createNotificationPlugin } = await import("./index.js");
        const winPlugin = createNotificationPlugin();

        const notification = makeNotification();
        await winPlugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
      });

      it("works on Linux", async () => {
        mockPlatform.mockReturnValue("linux");
        const { createNotificationPlugin } = await import("./index.js");
        const linuxPlugin = createNotificationPlugin();

        const notification = makeNotification();
        await linuxPlugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
      });
    });
  });

  // =============================================================================
  // NOTIFICATION COALESCING (Story 3.2)
  // =============================================================================

  describe("Notification Coalescing (Story 3.2)", () => {
    let plugin: NotificationPlugin;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockNotify.mockImplementation(
        (_options: unknown, callback: (error: Error | null, response?: unknown) => void) => {
          callback(null, {}); // Success
        },
      );
      vi.useFakeTimers();

      const { createNotificationPlugin } = await import("./index.js");
      // Create plugin with coalescing enabled
      plugin = createNotificationPlugin({ coalesceWindow: 60000 }); // 60 seconds
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function makeNotification(overrides: Partial<Notification> = {}): Notification {
      return {
        eventId: "evt-1",
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Story 3.2 agent is blocked",
        timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
        ...overrides,
      };
    }

    describe("coalescing similar notifications", () => {
      it("sends first notification immediately", async () => {
        const notification = makeNotification();
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
      });

      it("coalesces second notification of same type within window", async () => {
        const notification1 = makeNotification({ eventId: "evt-1" });
        const notification2 = makeNotification({ eventId: "evt-2" });

        await plugin.send(notification1);
        await plugin.send(notification2);

        // Only one notification sent so far (coalesced)
        expect(mockNotify).toHaveBeenCalledTimes(1);

        // Advance timer past coalesce window
        vi.advanceTimersByTime(61000);
        await vi.runAllTimersAsync();

        // Second notification should be sent with count
        expect(mockNotify).toHaveBeenCalledTimes(2);
        const lastCall = mockNotify.mock.calls[1][0];
        expect(lastCall.message).toContain("(2)"); // Count indicator
      });

      it("sends different event types immediately", async () => {
        const notification1 = makeNotification({
          eventType: "agent.blocked",
          title: "Agent Blocked",
        });
        const notification2 = makeNotification({
          eventType: "conflict.detected",
          title: "Conflict Detected",
        });

        await plugin.send(notification1);
        await plugin.send(notification2);

        // Both notifications sent immediately (different types)
        expect(mockNotify).toHaveBeenCalledTimes(2);
      });

      it("resets coalesce window after flush", async () => {
        const notification1 = makeNotification({ eventId: "evt-1" });
        const notification2 = makeNotification({ eventId: "evt-2" });
        const notification3 = makeNotification({ eventId: "evt-3" });

        await plugin.send(notification1);
        await plugin.send(notification2);

        // Flush coalesced notification
        vi.advanceTimersByTime(61000);
        await vi.runAllTimersAsync();

        await plugin.send(notification3);

        // Third notification starts a new coalesce window and is sent immediately
        expect(mockNotify).toHaveBeenCalledTimes(3); // First (immediate) + Flush (coalesced) + Third (immediate)
      });
    });

    describe("coalescing configuration", () => {
      it("allows custom coalesce window", async () => {
        const { createNotificationPlugin } = await import("./index.js");
        const customPlugin = createNotificationPlugin({ coalesceWindow: 5000 }); // 5 seconds

        const notification1 = makeNotification({ eventId: "evt-1" });
        const notification2 = makeNotification({ eventId: "evt-2" });

        await customPlugin.send(notification1);
        await customPlugin.send(notification2);

        expect(mockNotify).toHaveBeenCalledTimes(1);

        // Advance past shorter window
        vi.advanceTimersByTime(5100);
        await vi.runAllTimersAsync();

        expect(mockNotify).toHaveBeenCalledTimes(2);
      });

      it("disables coalescing when window is 0", async () => {
        const { createNotificationPlugin } = await import("./index.js");
        const noCoalescePlugin = createNotificationPlugin({ coalesceWindow: 0 });

        const notification1 = makeNotification({ eventId: "evt-1" });
        const notification2 = makeNotification({ eventId: "evt-2" });

        await noCoalescePlugin.send(notification1);
        await noCoalescePlugin.send(notification2);

        // Both sent immediately (no coalescing)
        expect(mockNotify).toHaveBeenCalledTimes(2);
      });
    });
  });

  // =============================================================================
  // FOCUS MODE DETECTION (Story 3.2)
  // =============================================================================

  describe("Focus Mode Detection (Story 3.2)", () => {
    function makeNotification(overrides: Partial<Notification> = {}): Notification {
      return {
        eventId: "evt-1",
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Story 3.2 agent is blocked",
        timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
        ...overrides,
      };
    }

    describe("with focus mode detection enabled", () => {
      let plugin: NotificationPlugin;

      beforeEach(async () => {
        vi.clearAllMocks();
        mockNotify.mockImplementation(
          (_options: unknown, callback: (error: Error | null, response?: unknown) => void) => {
            callback(null, {});
          },
        );

        const { createNotificationPlugin } = await import("./index.js");
        // Mock focus mode detection to return true
        plugin = createNotificationPlugin({
          respectFocusMode: true,
          detectFocusMode: async () => true,
        });
      });

      it("suppresses notification when focus mode is active", async () => {
        const notification = makeNotification();
        await plugin.send(notification);

        // Notification suppressed
        expect(mockNotify).not.toHaveBeenCalled();
      });

      it("allows notification when focus mode is inactive", async () => {
        const { createNotificationPlugin } = await import("./index.js");
        const plugin = createNotificationPlugin({
          respectFocusMode: true,
          detectFocusMode: async () => false, // Focus mode inactive
        });

        const notification = makeNotification();
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
      });
    });

    describe("with focus mode detection disabled", () => {
      it("sends notifications regardless of focus mode", async () => {
        const { createNotificationPlugin } = await import("./index.js");
        const plugin = createNotificationPlugin({
          respectFocusMode: false, // Don't respect focus mode
          detectFocusMode: async () => true, // Even if focus mode is active
        });

        const notification = makeNotification();
        await plugin.send(notification);

        expect(mockNotify).toHaveBeenCalledOnce();
      });
    });

    describe("focus mode detection failure", () => {
      it("fails open - sends notification when detection fails", async () => {
        const { createNotificationPlugin } = await import("./index.js");
        const plugin = createNotificationPlugin({
          respectFocusMode: true,
          detectFocusMode: async () => {
            throw new Error("Detection failed");
          },
        });

        const notification = makeNotification();
        await plugin.send(notification);

        // Should still send notification (fail open)
        expect(mockNotify).toHaveBeenCalledOnce();
      });
    });
  });
});
