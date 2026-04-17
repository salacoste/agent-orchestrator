/**
 * Tests for MarkdownV2 escape utility.
 * Story 57.1 Task 8.4.
 */
import { describe, it, expect } from "vitest";
import { escapeMarkdownV2 } from "../markdown-escape.js";

describe("escapeMarkdownV2", () => {
  it("returns empty string for empty input", () => {
    expect(escapeMarkdownV2("")).toBe("");
  });

  it("returns unchanged string with no special characters", () => {
    expect(escapeMarkdownV2("hello world 123")).toBe("hello world 123");
  });

  it("escapes underscore", () => {
    expect(escapeMarkdownV2("hello_world")).toBe("hello\\_world");
  });

  it("escapes asterisk", () => {
    expect(escapeMarkdownV2("bold*text")).toBe("bold\\*text");
  });

  it("escapes square brackets", () => {
    expect(escapeMarkdownV2("[link]")).toBe("\\[link\\]");
  });

  it("escapes parentheses", () => {
    expect(escapeMarkdownV2("(text)")).toBe("\\(text\\)");
  });

  it("escapes tilde", () => {
    expect(escapeMarkdownV2("~strike~")).toBe("\\~strike\\~");
  });

  it("escapes backtick", () => {
    expect(escapeMarkdownV2("`code`")).toBe("\\`code\\`");
  });

  it("escapes hash", () => {
    expect(escapeMarkdownV2("#heading")).toBe("\\#heading");
  });

  it("escapes plus", () => {
    expect(escapeMarkdownV2("1+2")).toBe("1\\+2");
  });

  it("escapes minus", () => {
    expect(escapeMarkdownV2("a-b")).toBe("a\\-b");
  });

  it("escapes equals", () => {
    expect(escapeMarkdownV2("a=b")).toBe("a\\=b");
  });

  it("escapes pipe", () => {
    expect(escapeMarkdownV2("a|b")).toBe("a\\|b");
  });

  it("escapes curly braces", () => {
    expect(escapeMarkdownV2("{obj}")).toBe("\\{obj\\}");
  });

  it("escapes dot", () => {
    expect(escapeMarkdownV2("file.ts")).toBe("file\\.ts");
  });

  it("escapes exclamation mark", () => {
    expect(escapeMarkdownV2("wow!")).toBe("wow\\!");
  });

  it("escapes greater than", () => {
    expect(escapeMarkdownV2(">quote")).toBe("\\>quote");
  });

  it("escapes all special characters in a single string", () => {
    const input = "_*[]()~`>#+-=|{}.!";
    const expected = "\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!";
    expect(escapeMarkdownV2(input)).toBe(expected);
  });

  it("handles mixed text with special characters", () => {
    const input = "Agent `claude` is blocked (error: timeout).";
    const expected = "Agent \\`claude\\` is blocked \\(error: timeout\\)\\.";
    expect(escapeMarkdownV2(input)).toBe(expected);
  });
});
