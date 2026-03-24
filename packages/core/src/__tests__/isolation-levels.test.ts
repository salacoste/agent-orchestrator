/**
 * Isolation levels tests (Story 46b.4).
 */
import { describe, expect, it } from "vitest";
import { resolveIsolation } from "../isolation-levels.js";
import { validateConfig } from "../config.js";

describe("resolveIsolation", () => {
  it("defaults to shared when undefined", () => {
    const policy = resolveIsolation();
    expect(policy.level).toBe("shared");
    expect(policy.ownWorktree).toBe(false);
    expect(policy.gitPushAllowed).toBe(true);
    expect(policy.networkAccess).toBe(true);
    expect(policy.crossProjectAccess).toBe(true);
  });

  it("returns shared policy", () => {
    const policy = resolveIsolation("shared");
    expect(policy.level).toBe("shared");
    expect(policy.ownWorktree).toBe(false);
    expect(policy.crossProjectAccess).toBe(true);
  });

  it("returns isolated policy", () => {
    const policy = resolveIsolation("isolated");
    expect(policy.level).toBe("isolated");
    expect(policy.ownWorktree).toBe(true);
    expect(policy.gitPushAllowed).toBe(true);
    expect(policy.networkAccess).toBe(true);
    expect(policy.crossProjectAccess).toBe(false);
  });

  it("returns quarantined policy", () => {
    const policy = resolveIsolation("quarantined");
    expect(policy.level).toBe("quarantined");
    expect(policy.ownWorktree).toBe(true);
    expect(policy.gitPushAllowed).toBe(false);
    expect(policy.networkAccess).toBe(false);
    expect(policy.crossProjectAccess).toBe(false);
  });

  it("quarantined is the most restrictive", () => {
    const q = resolveIsolation("quarantined");
    expect(q.gitPushAllowed).toBe(false);
    expect(q.networkAccess).toBe(false);
    expect(q.crossProjectAccess).toBe(false);
  });

  it("isolated allows network and push but not cross-project", () => {
    const i = resolveIsolation("isolated");
    expect(i.gitPushAllowed).toBe(true);
    expect(i.networkAccess).toBe(true);
    expect(i.crossProjectAccess).toBe(false);
  });
});

describe("isolation config schema", () => {
  it("defaults to shared in project config", () => {
    const config = validateConfig({
      projects: {
        app: { repo: "test/app", path: "/tmp/app" },
      },
    });
    expect(config.projects.app.isolation).toBe("shared");
  });

  it("accepts valid isolation levels", () => {
    const config = validateConfig({
      projects: {
        app: { repo: "test/app", path: "/tmp/app", isolation: "quarantined" },
      },
    });
    expect(config.projects.app.isolation).toBe("quarantined");
  });

  it("rejects invalid isolation level", () => {
    expect(() =>
      validateConfig({
        projects: {
          app: { repo: "test/app", path: "/tmp/app", isolation: "maximum" },
        },
      }),
    ).toThrow();
  });
});
