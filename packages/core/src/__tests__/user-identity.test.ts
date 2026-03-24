/**
 * User identity tests (Story 46b.1).
 */
import { describe, expect, it } from "vitest";
import { resolveUser, hasPermission, ANONYMOUS_USER, type ConfigUser } from "../user-identity.js";
import { getDefaultConfig, validateConfig } from "../config.js";

const USERS: ConfigUser[] = [
  { id: "alice", name: "Alice", role: "lead", email: "alice@co.com" },
  { id: "bob", name: "Bob", role: "dev" },
];

describe("resolveUser", () => {
  it("resolves known user by ID", () => {
    const user = resolveUser("alice", USERS);
    expect(user.id).toBe("alice");
    expect(user.name).toBe("Alice");
    expect(user.role).toBe("lead");
  });

  it("returns anonymous for unknown ID", () => {
    const user = resolveUser("unknown", USERS);
    expect(user).toBe(ANONYMOUS_USER);
  });

  it("returns anonymous for null ID", () => {
    const user = resolveUser(null, USERS);
    expect(user).toBe(ANONYMOUS_USER);
  });

  it("returns anonymous for empty users list", () => {
    const user = resolveUser("alice", []);
    expect(user).toBe(ANONYMOUS_USER);
  });
});

describe("ANONYMOUS_USER", () => {
  it("has admin role", () => {
    expect(ANONYMOUS_USER.role).toBe("admin");
    expect(ANONYMOUS_USER.id).toBe("anonymous");
    expect(ANONYMOUS_USER.name).toBe("Anonymous");
  });
});

describe("hasPermission", () => {
  it("admin has all permissions", () => {
    expect(hasPermission("admin", "admin")).toBe(true);
    expect(hasPermission("admin", "lead")).toBe(true);
    expect(hasPermission("admin", "dev")).toBe(true);
    expect(hasPermission("admin", "viewer")).toBe(true);
  });

  it("viewer has only viewer permission", () => {
    expect(hasPermission("viewer", "viewer")).toBe(true);
    expect(hasPermission("viewer", "dev")).toBe(false);
    expect(hasPermission("viewer", "lead")).toBe(false);
    expect(hasPermission("viewer", "admin")).toBe(false);
  });

  it("dev has dev and viewer permission", () => {
    expect(hasPermission("dev", "dev")).toBe(true);
    expect(hasPermission("dev", "viewer")).toBe(true);
    expect(hasPermission("dev", "lead")).toBe(false);
  });

  it("lead has lead, dev, and viewer permission", () => {
    expect(hasPermission("lead", "lead")).toBe(true);
    expect(hasPermission("lead", "dev")).toBe(true);
    expect(hasPermission("lead", "viewer")).toBe(true);
    expect(hasPermission("lead", "admin")).toBe(false);
  });
});

describe("users config schema", () => {
  it("defaults to empty users array", () => {
    const config = getDefaultConfig();
    expect(config.users).toEqual([]);
  });

  it("accepts valid users config", () => {
    const config = validateConfig({
      projects: {},
      users: [
        { id: "alice", name: "Alice", role: "lead", email: "alice@co.com" },
        { id: "bob", name: "Bob", role: "dev" },
      ],
    });
    expect(config.users).toHaveLength(2);
    expect(config.users?.[0].role).toBe("lead");
  });

  it("rejects invalid role", () => {
    expect(() =>
      validateConfig({
        projects: {},
        users: [{ id: "x", name: "X", role: "superadmin" }],
      }),
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      validateConfig({
        projects: {},
        users: [{ id: "x", name: "X", role: "dev", email: "not-email" }],
      }),
    ).toThrow();
  });
});
