import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerNotify } from "../../src/commands/notify.js";

describe("notify command", () => {
  let program: Command;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("registers the notify command", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    expect(command).toBeDefined();
  });

  it("has correct description", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    expect(command?.description()).toBe("Send a test desktop notification");
  });

  it("has --priority option", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    const options = command?.options ?? [];
    const priorityOption = options.find((opt) => opt.long === "--priority");
    expect(priorityOption).toBeDefined();
  });

  it("has --title option", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    const options = command?.options ?? [];
    const titleOption = options.find((opt) => opt.long === "--title");
    expect(titleOption).toBeDefined();
  });

  it("has --message option", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    const options = command?.options ?? [];
    const messageOption = options.find((opt) => opt.long === "--message");
    expect(messageOption).toBeDefined();
  });

  it("has --event-type option", () => {
    registerNotify(program);
    const command = program.commands.find((cmd) => cmd.name() === "notify");
    const options = command?.options ?? [];
    const eventTypeOption = options.find((opt) => opt.long === "--event-type");
    expect(eventTypeOption).toBeDefined();
  });
});
