/**
 * Annotation store tests (Story 42.1).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  addAnnotation,
  getAnnotations,
  getAllAnnotations,
  subscribeCollaborationChanges,
  _resetCollaboration,
  type CollaborationEvent,
} from "../collaboration";

beforeEach(() => {
  _resetCollaboration();
});

describe("Annotation store", () => {
  it("addAnnotation creates annotation with id and timestamp", () => {
    const a = addAnnotation({ artifactId: "prd.md", author: "Alice", text: "Looks good" });

    expect(a.id).toMatch(/^annotation-\d+-\d+$/);
    expect(a.artifactId).toBe("prd.md");
    expect(a.author).toBe("Alice");
    expect(a.text).toBe("Looks good");
    expect(a.timestamp).toBeDefined();
  });

  it("getAnnotations filters by artifactId", () => {
    addAnnotation({ artifactId: "prd.md", author: "Alice", text: "Comment 1" });
    addAnnotation({ artifactId: "arch.md", author: "Bob", text: "Comment 2" });
    addAnnotation({ artifactId: "prd.md", author: "Charlie", text: "Comment 3" });

    const prdAnnotations = getAnnotations("prd.md");
    expect(prdAnnotations).toHaveLength(2);
    expect(prdAnnotations[0].author).toBe("Alice");
    expect(prdAnnotations[1].author).toBe("Charlie");
  });

  it("getAnnotations returns empty array for unknown artifact", () => {
    expect(getAnnotations("nonexistent.md")).toEqual([]);
  });

  it("getAllAnnotations returns all annotations", () => {
    addAnnotation({ artifactId: "a.md", author: "A", text: "1" });
    addAnnotation({ artifactId: "b.md", author: "B", text: "2" });

    expect(getAllAnnotations()).toHaveLength(2);
  });

  it("addAnnotation emits collaboration event", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    addAnnotation({ artifactId: "prd.md", author: "Alice", text: "Nice" });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("annotation");
    if (events[0].type === "annotation") {
      expect(events[0].action).toBe("add");
      expect(events[0].data.artifactId).toBe("prd.md");
    }
  });

  it("_resetCollaboration clears annotations", () => {
    addAnnotation({ artifactId: "a.md", author: "A", text: "1" });
    expect(getAllAnnotations()).toHaveLength(1);

    _resetCollaboration();
    expect(getAllAnnotations()).toHaveLength(0);
  });
});
