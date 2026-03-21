import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WatchCallback = (eventType: string, filename: string | null) => void;

interface MockWatcherInstance {
  path: string;
  callback: WatchCallback;
  errorHandlers: Array<(err: Error) => void>;
  closed: boolean;
}

const { watchInstances, mockExistsSync, mockWatch } = vi.hoisted(() => {
  const instances: MockWatcherInstance[] = [];
  return {
    watchInstances: instances,
    mockExistsSync: vi.fn((): boolean => true),
    mockWatch: vi.fn((path: string, _opts: unknown, callback: WatchCallback) => {
      const instance: MockWatcherInstance = {
        path,
        callback,
        errorHandlers: [],
        closed: false,
      };
      instances.push(instance);
      return {
        on: vi.fn((event: string, handler: (err: Error) => void) => {
          if (event === "error") {
            instance.errorHandlers.push(handler);
          }
        }),
        close: vi.fn(() => {
          instance.closed = true;
        }),
      };
    }),
  };
});

vi.mock("node:fs", () => {
  const mod = { existsSync: mockExistsSync, watch: mockWatch };
  return { ...mod, default: mod };
});

import { subscribeWorkflowChanges, _resetForTesting } from "../../workflow-watcher";

function fireChange(watcherIndex = 0, filename = "somefile.md"): void {
  watchInstances[watcherIndex]?.callback("change", filename);
}

beforeEach(() => {
  vi.useFakeTimers();
  watchInstances.length = 0;
  mockExistsSync.mockReturnValue(true);
  _resetForTesting();
});

afterEach(() => {
  _resetForTesting();
  vi.useRealTimers();
});

describe("workflow-watcher", () => {
  describe("lazy initialization", () => {
    it("does not call fs.watch until first subscribe", () => {
      expect(watchInstances).toHaveLength(0);

      const unsub = subscribeWorkflowChanges(() => {});
      expect(watchInstances.length).toBeGreaterThan(0);
      unsub();
    });

    it("creates watchers for all 4 configured directories", () => {
      const unsub = subscribeWorkflowChanges(() => {});
      expect(watchInstances).toHaveLength(4);
      unsub();
    });

    it("does not re-initialize on second subscribe", () => {
      const unsub1 = subscribeWorkflowChanges(() => {});
      const count = watchInstances.length;
      const unsub2 = subscribeWorkflowChanges(() => {});
      expect(watchInstances).toHaveLength(count);
      unsub1();
      unsub2();
    });
  });

  describe("debounce", () => {
    it("coalesces 10 rapid events into a single callback", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      for (let i = 0; i < 10; i++) {
        fireChange();
      }

      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it("resets debounce timer on each new event", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      fireChange();
      vi.advanceTimersByTime(150);
      expect(cb).not.toHaveBeenCalled();

      fireChange();
      vi.advanceTimersByTime(150);
      expect(cb).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it("fires separate callbacks for events separated by more than 200ms", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      fireChange();
      vi.advanceTimersByTime(200);
      expect(cb).toHaveBeenCalledTimes(1);

      fireChange();
      vi.advanceTimersByTime(200);
      expect(cb).toHaveBeenCalledTimes(2);
      unsub();
    });
  });

  describe("fan-out", () => {
    it("notifies all subscribers on a single event", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();
      const unsub1 = subscribeWorkflowChanges(cb1);
      const unsub2 = subscribeWorkflowChanges(cb2);
      const unsub3 = subscribeWorkflowChanges(cb3);

      fireChange();
      vi.advanceTimersByTime(200);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
      unsub1();
      unsub2();
      unsub3();
    });

    it("continues fan-out even if one listener throws", () => {
      const cb1 = vi.fn();
      const cbBad = vi.fn(() => {
        throw new Error("boom");
      });
      const cb3 = vi.fn();
      const unsub1 = subscribeWorkflowChanges(cb1);
      const unsub2 = subscribeWorkflowChanges(cbBad);
      const unsub3 = subscribeWorkflowChanges(cb3);

      fireChange();
      vi.advanceTimersByTime(200);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cbBad).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
      unsub1();
      unsub2();
      unsub3();
    });
  });

  describe("subscribe/unsubscribe lifecycle", () => {
    it("does not call unsubscribed listener", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      unsub();

      fireChange();
      vi.advanceTimersByTime(200);

      expect(cb).not.toHaveBeenCalled();
    });

    it("only removes the specific listener on unsubscribe", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = subscribeWorkflowChanges(cb1);
      const unsub2 = subscribeWorkflowChanges(cb2);

      unsub1();

      fireChange();
      vi.advanceTimersByTime(200);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
      unsub2();
    });
  });

  describe("error handling", () => {
    it("does not crash when a watcher emits an error", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      const firstWatcher = watchInstances[0]!;
      expect(() => {
        for (const handler of firstWatcher.errorHandlers) {
          handler(new Error("ENOENT: no such file or directory"));
        }
      }).not.toThrow();

      unsub();
    });

    it("still delivers events from other watchers after one errors", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      for (const handler of watchInstances[0]!.errorHandlers) {
        handler(new Error("ENOENT"));
      }

      watchInstances[1]?.callback("change", "test.md");
      vi.advanceTimersByTime(200);

      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  describe("skips non-existent directories", () => {
    it("creates no watchers when all directories are missing", () => {
      mockExistsSync.mockReturnValue(false);
      const unsub = subscribeWorkflowChanges(() => {});
      expect(watchInstances).toHaveLength(0);
      unsub();
    });
  });

  describe("cross-watcher debounce", () => {
    it("coalesces events from different watchers into a single callback", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      fireChange(0);
      fireChange(1);
      fireChange(2);
      vi.advanceTimersByTime(200);

      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  describe("watch() initialization errors", () => {
    it("does not crash when watch() throws", () => {
      mockWatch.mockImplementationOnce(() => {
        throw new Error("ENOSYS: function not implemented");
      });

      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      // Should still create watchers for the remaining directories
      expect(watchInstances.length).toBe(3);
      unsub();
    });
  });

  describe("watcher cleanup on last unsubscribe", () => {
    it("closes all watchers when last listener unsubscribes", () => {
      const unsub1 = subscribeWorkflowChanges(() => {});
      const unsub2 = subscribeWorkflowChanges(() => {});
      expect(watchInstances.length).toBe(4);

      unsub1();
      // Watchers still alive — one listener remains
      for (const w of watchInstances) {
        expect(w.closed).toBe(false);
      }

      unsub2();
      // All listeners gone — watchers should be closed
      for (const w of watchInstances) {
        expect(w.closed).toBe(true);
      }
    });

    it("re-initializes watchers on new subscribe after full cleanup", () => {
      const unsub = subscribeWorkflowChanges(() => {});
      const firstBatch = watchInstances.length;
      unsub();

      // Clear tracking array to count new instances
      watchInstances.length = 0;

      const unsub2 = subscribeWorkflowChanges(() => {});
      expect(watchInstances.length).toBe(firstBatch);
      unsub2();
    });
  });

  describe("filename filter for _bmad/_config", () => {
    it("ignores non-manifest file changes in _bmad/_config watcher", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      // _bmad/_config is the 4th watcher (index 3)
      const configWatcher = watchInstances[3]!;
      configWatcher.callback("change", "some-other-file.yaml");
      vi.advanceTimersByTime(200);

      expect(cb).not.toHaveBeenCalled();
      unsub();
    });

    it("triggers on agent-manifest.csv changes in _bmad/_config watcher", () => {
      const cb = vi.fn();
      const unsub = subscribeWorkflowChanges(cb);

      const configWatcher = watchInstances[3]!;
      configWatcher.callback("change", "agent-manifest.csv");
      vi.advanceTimersByTime(200);

      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  describe("_resetForTesting", () => {
    it("closes all watchers and clears state", () => {
      subscribeWorkflowChanges(() => {});
      expect(watchInstances.length).toBeGreaterThan(0);

      _resetForTesting();

      for (const w of watchInstances) {
        expect(w.closed).toBe(true);
      }
    });
  });
});
