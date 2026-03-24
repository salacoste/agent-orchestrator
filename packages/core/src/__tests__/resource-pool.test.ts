/**
 * Resource pool tests (Story 46b.3).
 */
import { describe, expect, it } from "vitest";
import { createResourcePool } from "../resource-pool.js";
import { validateConfig } from "../config.js";

describe("createResourcePool", () => {
  it("enforces per-project limits", () => {
    const pool = createResourcePool({ total: 10, projects: { app: 2 } });

    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("app")).toBe(false); // At limit
  });

  it("enforces total pool limit", () => {
    const pool = createResourcePool({ total: 3, projects: { app: 5, lib: 5 } });

    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("lib")).toBe(true);
    expect(pool.acquire("lib")).toBe(false); // Total limit reached
  });

  it("release frees a slot", () => {
    const pool = createResourcePool({ total: 10, projects: { app: 1 } });

    pool.acquire("app");
    expect(pool.canSpawn("app")).toBe(false);

    pool.release("app");
    expect(pool.canSpawn("app")).toBe(true);
    expect(pool.acquire("app")).toBe(true);
  });

  it("release is safe when nothing acquired", () => {
    const pool = createResourcePool({ total: 10, projects: {} });
    pool.release("nonexistent"); // Should not throw
  });

  it("returns pool state with usage", () => {
    const pool = createResourcePool({ total: 10, projects: { app: 6, lib: 4 } });

    pool.acquire("app");
    pool.acquire("app");
    pool.acquire("lib");

    const state = pool.getState();
    expect(state.total.used).toBe(3);
    expect(state.total.max).toBe(10);
    expect(state.projects.app.used).toBe(2);
    expect(state.projects.app.max).toBe(6);
    expect(state.projects.lib.used).toBe(1);
    expect(state.projects.lib.max).toBe(4);
  });

  it("includes unconfigured projects in state", () => {
    const pool = createResourcePool({ total: 10, projects: { app: 5 } });
    pool.acquire("unknown-project");

    const state = pool.getState();
    expect(state.projects["unknown-project"].used).toBe(1);
    expect(state.projects["unknown-project"].max).toBeNull();
  });

  it("allows unlimited when no config", () => {
    const pool = createResourcePool();

    expect(pool.canSpawn("any")).toBe(true);
    expect(pool.acquire("any")).toBe(true);
    expect(pool.acquire("any")).toBe(true);

    const state = pool.getState();
    expect(state.total.max).toBeNull();
  });

  it("canSpawn checks both project and total limits", () => {
    const pool = createResourcePool({ total: 2, projects: { app: 3 } });

    pool.acquire("app");
    pool.acquire("app");
    // Total is 2, project limit is 3 — total blocks first
    expect(pool.canSpawn("app")).toBe(false);
  });

  it("projects without config entry have no per-project limit", () => {
    const pool = createResourcePool({ total: 5, projects: {} });

    // No per-project limit for "app" — only total matters
    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("app")).toBe(true);
    expect(pool.acquire("app")).toBe(true);
  });

  it("throws on NaN total", () => {
    expect(() => createResourcePool({ total: NaN, projects: {} })).toThrow("Invalid");
  });

  it("throws on Infinity total", () => {
    expect(() => createResourcePool({ total: Infinity, projects: {} })).toThrow("Invalid");
  });

  it("cleans up usage map entries on release to zero", () => {
    const pool = createResourcePool();
    pool.acquire("temp-project");
    pool.release("temp-project");

    const state = pool.getState();
    // Project with 0 usage should be removed from tracking
    expect(state.projects["temp-project"]).toBeUndefined();
  });
});

describe("resourcePool config schema", () => {
  it("accepts valid resource pool config", () => {
    const config = validateConfig({
      projects: {},
      resourcePool: { total: 10, projects: { app: 6, lib: 4 } },
    });
    expect(config.resourcePool?.total).toBe(10);
  });

  it("is optional (undefined by default)", () => {
    const config = validateConfig({ projects: {} });
    expect(config.resourcePool).toBeUndefined();
  });

  it("rejects non-positive total", () => {
    expect(() =>
      validateConfig({ projects: {}, resourcePool: { total: 0, projects: {} } }),
    ).toThrow();
  });
});
