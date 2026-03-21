/**
 * Conflict History API Tests
 *
 * Tests for the conflicts API endpoint.
 */

import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";

// Mock the dependencies
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {
        "test-project": {
          path: "/test/path",
          tracker: { plugin: "bmad" },
        },
      },
      configPath: "/test/config",
    },
  })),
}));

vi.mock("@composio/ao-core", () => ({
  createConflictDetectionService: vi.fn(() => ({
    getConflicts: vi.fn(() => []),
  })),
  getAgentRegistry: vi.fn(() => ({})),
  getSessionsDir: vi.fn(() => "/test/sessions"),
}));

describe("/api/sprint/[project]/conflicts", () => {
  describe("GET", () => {
    it("should return empty conflicts list when no conflicts exist", async () => {
      const request = new Request("http://localhost:3000/api/sprint/test-project/conflicts");
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(data).toEqual({
        conflicts: [],
        summary: {
          total: 0,
          bySeverity: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
          byType: {
            "duplicate-assignment": 0,
          },
        },
      });
    });

    it("should return 404 for unknown project", async () => {
      // Mock getServices to return null project
      const { getServices } = await import("@/lib/services");
      // Only config is used by the route handler; provide stub registry/sessionManager
      const mockRegistry = {
        register: vi.fn(),
        get: vi.fn().mockReturnValue(null),
        list: vi.fn().mockReturnValue([]),
        loadBuiltins: vi.fn(),
        loadFromConfig: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(false),
        shutdownAll: vi.fn(),
        reload: vi.fn().mockResolvedValue(false),
        getPluginState: vi.fn().mockReturnValue(null),
        isRegistered: vi.fn().mockReturnValue(false),
      };
      const mockSessionManager = {
        spawn: vi.fn(),
        spawnOrchestrator: vi.fn(),
        restore: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        kill: vi.fn(),
        cleanup: vi.fn(),
        send: vi.fn(),
      };
      vi.mocked(getServices).mockResolvedValueOnce({
        config: {
          projects: {},
          configPath: "/test/config",
          readyThresholdMs: 300000,
          defaults: {
            runtime: "tmux",
            agent: "claude-code",
            workspace: "worktree",
            notifiers: ["desktop"],
          },
          notifiers: {},
          notificationRouting: {
            urgent: ["desktop"],
            action: ["desktop"],
            warning: ["desktop"],
            info: ["desktop"],
          },
          reactions: {},
        },
        registry: mockRegistry,
        sessionManager: mockSessionManager,
      });

      const request = new Request("http://localhost:3000/api/sprint/unknown-project/conflicts");
      const params = Promise.resolve({ project: "unknown-project" });

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });

    it("should support sorting by recency", async () => {
      const request = new Request(
        "http://localhost:3000/api/sprint/test-project/conflicts?sort=recency",
      );
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);
    });

    it("should support sorting by frequency", async () => {
      const request = new Request(
        "http://localhost:3000/api/sprint/test-project/conflicts?sort=frequency",
      );
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);
    });

    it("should return CSV when export=csv", async () => {
      const request = new Request(
        "http://localhost:3000/api/sprint/test-project/conflicts?export=csv",
      );
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });

      expect(response.headers.get("Content-Type")).toBe("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain(".csv");
    });

    it("should return JSON file when export=json", async () => {
      const request = new Request(
        "http://localhost:3000/api/sprint/test-project/conflicts?export=json",
      );
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });

      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Content-Disposition")).toContain(".json");
    });
  });

  describe("error handling", () => {
    it("should return 500 on error", async () => {
      // Mock getServices to throw an error
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce(new Error("Service error"));

      const request = new Request("http://localhost:3000/api/sprint/test-project/conflicts");
      const params = Promise.resolve({ project: "test-project" });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch conflicts");
    });
  });
});
