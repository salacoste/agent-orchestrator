/**
 * Tests for persistence-aware session timeout (Story 59-7).
 *
 * Covers:
 * - EXECUTION_MODE_TIMEOUT_MULTIPLIERS completeness
 * - resolveSessionTimeout() for each execution mode
 * - resolveSessionTimeout() clamping behavior
 * - resolveSessionTimeout() with custom multipliers from config
 * - getTimeoutForAgent() with and without execution mode
 * - checkBlocked() reads execution mode from session metadata
 * - Backward compatibility: sessions without execution mode
 */

import { describe, it, expect, vi } from "vitest";
import type { BlockedAgentDetectorDeps } from "../blocked-agent-detector.js";
import { EXECUTION_MODE_TIMEOUT_MULTIPLIERS, resolveSessionTimeout } from "../session-timeout.js";

// ---------------------------------------------------------------------------
// EXECUTION_MODE_TIMEOUT_MULTIPLIERS
// ---------------------------------------------------------------------------

describe("EXECUTION_MODE_TIMEOUT_MULTIPLIERS", () => {
  it("has all 3 execution modes", () => {
    expect(Object.keys(EXECUTION_MODE_TIMEOUT_MULTIPLIERS)).toEqual([
      "standard",
      "persistent",
      "lightweight",
    ]);
  });

  it("standard multiplier is 1.0", () => {
    expect(EXECUTION_MODE_TIMEOUT_MULTIPLIERS.standard).toBe(1.0);
  });

  it("persistent multiplier is 3.0", () => {
    expect(EXECUTION_MODE_TIMEOUT_MULTIPLIERS.persistent).toBe(3.0);
  });

  it("lightweight multiplier is 0.5", () => {
    expect(EXECUTION_MODE_TIMEOUT_MULTIPLIERS.lightweight).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// resolveSessionTimeout — execution modes
// ---------------------------------------------------------------------------

describe("resolveSessionTimeout", () => {
  const baseTimeout = 10 * 60 * 1000; // 10 minutes

  it("returns base timeout for standard execution mode", () => {
    const result = resolveSessionTimeout(baseTimeout, "standard");
    expect(result).toBe(baseTimeout);
  });

  it("returns 3x timeout for persistent mode", () => {
    const result = resolveSessionTimeout(baseTimeout, "persistent");
    expect(result).toBe(30 * 60 * 1000); // 30 minutes
  });

  it("returns 0.5x timeout for lightweight mode", () => {
    const result = resolveSessionTimeout(baseTimeout, "lightweight");
    expect(result).toBe(5 * 60 * 1000); // 5 minutes
  });

  it("returns base timeout for undefined execution mode", () => {
    const result = resolveSessionTimeout(baseTimeout, undefined);
    expect(result).toBe(baseTimeout);
  });

  // ---------------------------------------------------------------------------
  // Clamping
  // ---------------------------------------------------------------------------

  describe("clamping", () => {
    const MIN_TIMEOUT = 1 * 60 * 1000; // 1 minute
    const MAX_TIMEOUT = 60 * 60 * 1000; // 60 minutes

    it("clamps to MIN_TIMEOUT when result is below minimum", () => {
      // 30s base * 0.5 = 15s, clamped to 1m
      const result = resolveSessionTimeout(30_000, "lightweight");
      expect(result).toBe(MIN_TIMEOUT);
    });

    it("clamps to MAX_TIMEOUT when result exceeds maximum", () => {
      // 30m base * 3.0 = 90m, clamped to 60m
      const result = resolveSessionTimeout(30 * 60 * 1000, "persistent");
      expect(result).toBe(MAX_TIMEOUT);
    });

    it("does not clamp when result is within range", () => {
      // 10m base * 3.0 = 30m, within range
      const result = resolveSessionTimeout(10 * 60 * 1000, "persistent");
      expect(result).toBe(30 * 60 * 1000);
    });

    it("clamps base timeout without mode if it exceeds MAX_TIMEOUT", () => {
      const result = resolveSessionTimeout(120 * 60 * 1000, undefined);
      expect(result).toBe(MAX_TIMEOUT);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom multipliers from config
  // ---------------------------------------------------------------------------

  describe("custom multipliers from config", () => {
    it("uses custom multiplier when provided", () => {
      const result = resolveSessionTimeout(10 * 60 * 1000, "persistent", {
        executionModeTimeouts: { persistent: 5.0 },
      });
      expect(result).toBe(50 * 60 * 1000);
    });

    it("uses default multiplier when custom not provided for mode", () => {
      const result = resolveSessionTimeout(10 * 60 * 1000, "persistent", {
        executionModeTimeouts: { lightweight: 0.25 },
      });
      expect(result).toBe(30 * 60 * 1000); // Still uses default 3.0
    });

    it("uses custom multiplier for lightweight", () => {
      const result = resolveSessionTimeout(10 * 60 * 1000, "lightweight", {
        executionModeTimeouts: { lightweight: 0.1 },
      });
      expect(result).toBe(1 * 60 * 1000); // 10m * 0.1 = 1m (exactly MIN_TIMEOUT)
    });

    it("ignores empty executionModeTimeouts", () => {
      const result = resolveSessionTimeout(10 * 60 * 1000, "persistent", {
        executionModeTimeouts: {},
      });
      expect(result).toBe(30 * 60 * 1000);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: BlockedAgentDetector.getTimeoutForAgent with execution mode
// ---------------------------------------------------------------------------

describe("getTimeoutForAgent with execution mode", () => {
  // We test the resolveSessionTimeout integration indirectly since
  // getTimeoutForAgent is private. The full integration is tested via
  // checkBlocked() below.

  it("resolveSessionTimeout integrates agent-type base with execution mode", () => {
    // Simulating claude-code agent (10m base) with persistent mode
    const claudeBase = 10 * 60 * 1000;
    const result = resolveSessionTimeout(claudeBase, "persistent");
    expect(result).toBe(30 * 60 * 1000); // 10m * 3 = 30m
  });

  it("resolveSessionTimeout for lightweight codex agent", () => {
    // Simulating codex agent (5m base) with lightweight mode
    const codexBase = 5 * 60 * 1000;
    const result = resolveSessionTimeout(codexBase, "lightweight");
    expect(result).toBe(2.5 * 60 * 1000); // 5m * 0.5 = 2.5m
  });

  it("resolveSessionTimeout for standard aider agent", () => {
    // Simulating aider agent (15m base) with standard mode
    const aiderBase = 15 * 60 * 1000;
    const result = resolveSessionTimeout(aiderBase, "standard");
    expect(result).toBe(15 * 60 * 1000); // 15m * 1.0 = 15m (unchanged)
  });
});

// ---------------------------------------------------------------------------
// checkBlocked reads execution mode from session metadata
// ---------------------------------------------------------------------------

describe("checkBlocked reads execution mode from metadata", () => {
  it("extracts valid execution mode from session metadata", async () => {
    const { createBlockedAgentDetector } = await import("../blocked-agent-detector.js");

    const mockSession = {
      metadata: { "ao:executionMode": "persistent" },
    };

    const deps = {
      eventBus: { publish: vi.fn().mockResolvedValue(undefined), name: "test" },
      registry: { register: vi.fn(), unregister: vi.fn(), getAll: vi.fn().mockReturnValue([]) },
      sessionManager: {
        get: vi.fn().mockResolvedValue(mockSession),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockReturnValue([]),
      },
      config: {
        defaultTimeout: 10 * 60 * 1000, // 10m
      },
    };

    const detector = createBlockedAgentDetector(deps as unknown as BlockedAgentDetectorDeps);

    // Track an agent that has been inactive for 20m (longer than 10m base, shorter than 30m persistent)
    await detector.trackActivity("claude-code-test-1");

    // Manually set last activity to 20 minutes ago by accessing internal state
    // We'll use a direct approach: advance time in the status
    const status = detector.getAgentStatus("claude-code-test-1");
    if (status) {
      // Backdate lastActivity by 20 minutes
      (status as { lastActivity: Date }).lastActivity = new Date(Date.now() - 20 * 60 * 1000);
    }

    await detector.checkBlocked();

    // With persistent mode (3x = 30m), 20m inactive should NOT be blocked
    expect(detector.getAgentStatus("claude-code-test-1")?.isBlocked).toBe(false);

    await detector.close();
  });

  it("blocks agent without execution mode using base timeout", async () => {
    const { createBlockedAgentDetector } = await import("../blocked-agent-detector.js");

    const deps = {
      eventBus: { publish: vi.fn().mockResolvedValue(undefined), name: "test" },
      registry: { register: vi.fn(), unregister: vi.fn(), getAll: vi.fn().mockReturnValue([]) },
      sessionManager: {
        get: vi.fn().mockResolvedValue({ metadata: {} }), // No execution mode
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockReturnValue([]),
      },
      config: {
        defaultTimeout: 10 * 60 * 1000, // 10m
      },
    };

    const detector = createBlockedAgentDetector(deps as unknown as BlockedAgentDetectorDeps);
    await detector.trackActivity("claude-code-test-2");

    const status = detector.getAgentStatus("claude-code-test-2");
    if (status) {
      // Backdate by 15 minutes (longer than 10m base timeout)
      (status as { lastActivity: Date }).lastActivity = new Date(Date.now() - 15 * 60 * 1000);
    }

    await detector.checkBlocked();

    // Without execution mode, 15m > 10m base → should be blocked
    expect(detector.getAgentStatus("claude-code-test-2")?.isBlocked).toBe(true);

    await detector.close();
  });

  it("handles session lookup failure gracefully", async () => {
    const { createBlockedAgentDetector } = await import("../blocked-agent-detector.js");

    const deps = {
      eventBus: { publish: vi.fn().mockResolvedValue(undefined), name: "test" },
      registry: { register: vi.fn(), unregister: vi.fn(), getAll: vi.fn().mockReturnValue([]) },
      sessionManager: {
        get: vi.fn().mockRejectedValue(new Error("Session lookup failed")),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockReturnValue([]),
      },
      config: {
        defaultTimeout: 10 * 60 * 1000,
      },
    };

    const detector = createBlockedAgentDetector(deps as unknown as BlockedAgentDetectorDeps);
    await detector.trackActivity("claude-code-test-3");

    const status = detector.getAgentStatus("claude-code-test-3");
    if (status) {
      // Backdate by 15 minutes
      (status as { lastActivity: Date }).lastActivity = new Date(Date.now() - 15 * 60 * 1000);
    }

    // Should NOT throw — falls back to agent-type timeout
    await expect(detector.checkBlocked()).resolves.toBeUndefined();

    // Falls back to base timeout (10m), 15m > 10m → blocked
    expect(detector.getAgentStatus("claude-code-test-3")?.isBlocked).toBe(true);

    await detector.close();
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  it("sessions without ao:executionMode use existing agent-type timeouts", async () => {
    const { createBlockedAgentDetector } = await import("../blocked-agent-detector.js");

    const deps = {
      eventBus: { publish: vi.fn().mockResolvedValue(undefined), name: "test" },
      registry: { register: vi.fn(), unregister: vi.fn(), getAll: vi.fn().mockReturnValue([]) },
      sessionManager: {
        get: vi.fn().mockResolvedValue({ metadata: {} }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockReturnValue([]),
      },
      config: {
        defaultTimeout: 10 * 60 * 1000,
      },
    };

    const detector = createBlockedAgentDetector(deps as unknown as BlockedAgentDetectorDeps);
    await detector.trackActivity("claude-code-test-compat");

    const status = detector.getAgentStatus("claude-code-test-compat");
    if (status) {
      // 8 minutes inactive — under 10m claude-code timeout
      (status as { lastActivity: Date }).lastActivity = new Date(Date.now() - 8 * 60 * 1000);
    }

    await detector.checkBlocked();
    expect(detector.getAgentStatus("claude-code-test-compat")?.isBlocked).toBe(false);

    await detector.close();
  });

  it("resolveSessionTimeout returns base when executionMode is undefined", () => {
    const result = resolveSessionTimeout(10 * 60 * 1000, undefined);
    expect(result).toBe(10 * 60 * 1000);
  });

  it("resolveSessionTimeout returns base when config is undefined", () => {
    const result = resolveSessionTimeout(10 * 60 * 1000, "standard", undefined);
    expect(result).toBe(10 * 60 * 1000);
  });
});
