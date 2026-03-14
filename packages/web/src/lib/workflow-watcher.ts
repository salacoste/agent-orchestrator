/**
 * Workflow file watcher singleton (WD-5).
 *
 * Watches BMAD artifact directories for changes and notifies all
 * SSE subscribers via a simple callback fan-out. Uses node:fs.watch()
 * with a 200ms debounce to coalesce rapid file-system events.
 *
 * Lazy initialization: watchers only start on the first subscriber.
 */
import { watch, existsSync, type FSWatcher } from "node:fs";
import { resolve } from "node:path";

type WatcherCallback = () => void;

/** Paths to watch, resolved from process.cwd() at init time. */
const WATCH_PATHS: Array<{ dir: string; filter: string | null }> = [
  { dir: "_bmad-output/planning-artifacts", filter: null },
  { dir: "_bmad-output/research", filter: null },
  { dir: "_bmad-output/implementation-artifacts", filter: null },
  { dir: "_bmad/_config", filter: "agent-manifest.csv" },
];

const DEBOUNCE_MS = 200;

let watchers: FSWatcher[] | null = null;
const listeners = new Set<WatcherCallback>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // Listener error must not break fan-out to other listeners.
    }
  }
}

function handleChange(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    notifyListeners();
  }, DEBOUNCE_MS);
}

function initWatcher(): void {
  const root = process.cwd();
  watchers = [];

  for (const { dir, filter } of WATCH_PATHS) {
    const fullPath = resolve(root, dir);
    if (!existsSync(fullPath)) {
      // Directory may not exist yet — skip silently (AC6).
      continue;
    }
    try {
      const fsw = watch(fullPath, { recursive: true }, (_eventType, filename) => {
        if (filter && filename !== filter) return;
        handleChange();
      });
      fsw.on("error", (err: Error) => {
        // Graceful degradation (AC6): warn and continue.
        console.warn(`[workflow-watcher] watcher error on ${dir}: ${err.message}`);
      });
      watchers.push(fsw);
    } catch {
      // watch() can throw on unsupported platforms — skip silently.
    }
  }
}

/**
 * Subscribe to workflow file-change notifications.
 *
 * Returns an unsubscribe function. Caller MUST invoke it when the
 * SSE stream closes to prevent memory leaks.
 */
export function subscribeWorkflowChanges(callback: WatcherCallback): () => void {
  if (!watchers) {
    initWatcher();
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && watchers) {
      for (const w of watchers) {
        w.close();
      }
      watchers = null;
    }
  };
}

/** @internal test-only helper — not part of public API. */
export function _resetForTesting(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watchers) {
    for (const w of watchers) {
      w.close();
    }
    watchers = null;
  }
  listeners.clear();
}
