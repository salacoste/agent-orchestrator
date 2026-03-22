/**
 * Handoff protocol tests (Story 42.3).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createHandoff, serializeHandoff, deserializeHandoff } from "../handoff";
import {
  logDecision,
  claimItem,
  addAnnotation,
  assignOwner,
  _resetCollaboration,
} from "../collaboration";

beforeEach(() => {
  _resetCollaboration();
});

describe("createHandoff", () => {
  it("creates bundle with sender, recipient, and timestamp", () => {
    const bundle = createHandoff("Alice", "Bob");

    expect(bundle).not.toBeNull();
    expect(bundle!.sender).toBe("Alice");
    expect(bundle!.recipient).toBe("Bob");
    expect(bundle!.createdAt).toBeDefined();
    expect(bundle!.message).toBeUndefined();
  });

  it("includes optional message", () => {
    const bundle = createHandoff("Alice", "Bob", "Check the auth module");
    expect(bundle!.message).toBe("Check the auth module");
  });

  it("captures current decisions", () => {
    logDecision({ who: "Alice", what: "Use JWT", why: "Security" });
    logDecision({ who: "Bob", what: "Add cache", why: "Performance" });

    const bundle = createHandoff("Alice", "Bob");

    expect(bundle!.decisions).toHaveLength(2);
    expect(bundle!.decisions[0].what).toBe("Use JWT");
  });

  it("captures current claims", () => {
    claimItem("pr-1", "Alice", "Review PR #1");

    const bundle = createHandoff("Alice", "Bob");

    expect(bundle!.claims).toHaveLength(1);
    expect(bundle!.claims[0].itemId).toBe("pr-1");
  });

  it("captures current annotations", () => {
    addAnnotation({ artifactId: "prd.md", author: "Alice", text: "Needs update" });

    const bundle = createHandoff("Alice", "Bob");

    expect(bundle!.annotations).toHaveLength(1);
    expect(bundle!.annotations[0].text).toBe("Needs update");
  });

  it("captures current ownership", () => {
    assignOwner("agent-1", "Alice");

    const bundle = createHandoff("Alice", "Bob");

    expect(bundle!.owners).toHaveLength(1);
    expect(bundle!.owners[0].owner).toBe("Alice");
  });

  it("returns empty arrays when no collaboration state exists", () => {
    const bundle = createHandoff("Alice", "Bob");

    expect(bundle).not.toBeNull();
    expect(bundle!.decisions).toEqual([]);
    expect(bundle!.claims).toEqual([]);
    expect(bundle!.annotations).toEqual([]);
    expect(bundle!.owners).toEqual([]);
  });

  it("returns null for empty sender or recipient", () => {
    expect(createHandoff("", "Bob")).toBeNull();
    expect(createHandoff("Alice", "")).toBeNull();
    expect(createHandoff("  ", "Bob")).toBeNull();
  });

  it("trims sender and recipient whitespace", () => {
    const bundle = createHandoff("  Alice  ", "  Bob  ");
    expect(bundle!.sender).toBe("Alice");
    expect(bundle!.recipient).toBe("Bob");
  });
});

describe("serializeHandoff / deserializeHandoff", () => {
  it("round-trips through JSON serialization", () => {
    logDecision({ who: "Alice", what: "Use JWT", why: "Security" });
    claimItem("pr-1", "Alice", "Review");

    const original = createHandoff("Alice", "Bob", "Handoff notes");
    const json = serializeHandoff(original);
    const restored = deserializeHandoff(json);

    expect(restored).not.toBeNull();
    expect(restored!.sender).toBe("Alice");
    expect(restored!.recipient).toBe("Bob");
    expect(restored!.message).toBe("Handoff notes");
    expect(restored!.decisions).toHaveLength(1);
    expect(restored!.claims).toHaveLength(1);
  });

  it("returns null for invalid JSON", () => {
    expect(deserializeHandoff("not json")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(deserializeHandoff('{"foo": "bar"}')).toBeNull();
  });

  it("produces valid JSON string", () => {
    const bundle = createHandoff("Alice", "Bob");
    const json = serializeHandoff(bundle);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain('"sender": "Alice"');
  });
});
