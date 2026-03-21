import { describe, it, expect, vi } from "vitest";
import { getNotificationPlugins } from "../../src/lib/plugins.js";
import type { OrchestratorConfig } from "@composio/ao-core";

function makeConfig(overrides?: {
  notifiers?: Record<string, { plugin?: string; [key: string]: unknown }>;
  defaultNotifiers?: string[];
}): OrchestratorConfig {
  return {
    dataDir: "/tmp",
    worktreeDir: "/tmp/wt",
    port: 5000,
    defaults: {
      runtime: "tmux",
      agent: "claude-code",
      workspace: "worktree",
      notifiers: overrides?.defaultNotifiers ?? [],
    },
    projects: {
      app: { name: "app", repo: "", path: "", defaultBranch: "main" },
    },
    notifiers: overrides?.notifiers ?? {},
    notificationRouting: {},
    reactions: {},
  } as OrchestratorConfig;
}

describe("getNotificationPlugins", () => {
  it("uses default notifiers when config.notifiers is empty", () => {
    const config = makeConfig({ defaultNotifiers: ["desktop"] });
    const plugins = getNotificationPlugins(config);

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("desktop");
  });

  it("returns plugins from explicit notifiers config", () => {
    const config = makeConfig({
      notifiers: {
        slack: { plugin: "slack", webhookUrl: "https://hooks.slack.com/test" },
      },
    });
    const plugins = getNotificationPlugins(config);

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("slack");
  });

  it("warns and skips unknown plugin names", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = makeConfig({
      notifiers: {
        foo: { plugin: "nonexistent" },
      },
    });
    const plugins = getNotificationPlugins(config);

    expect(plugins).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[notification] Unknown notifier plugin "nonexistent" — skipping',
    );

    warnSpy.mockRestore();
  });

  it("returns multiple plugins when multiple notifiers are configured", () => {
    const config = makeConfig({
      notifiers: {
        slack: { plugin: "slack", webhookUrl: "https://hooks.slack.com/test" },
        webhook: { plugin: "webhook", url: "https://example.com/hook" },
      },
    });
    const plugins = getNotificationPlugins(config);

    expect(plugins).toHaveLength(2);
    const names = plugins.map((p) => p.name);
    expect(names).toContain("slack");
    expect(names).toContain("webhook");
  });

  it("defaults plugin name to the config key when plugin field is omitted", () => {
    const config = makeConfig({
      notifiers: {
        desktop: {},
      },
    });
    const plugins = getNotificationPlugins(config);

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("desktop");
  });
});
