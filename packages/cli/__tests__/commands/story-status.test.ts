import { describe, it, expect, beforeEach } from "vitest";
import { Command } from "commander";
import { registerStoryStatus } from "../../src/commands/story-status.js";

describe("story-status command", () => {
  describe("command registration", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      registerStoryStatus(program);
    });

    it("registers story-status command", () => {
      const command = program.commands.find((c) => c.name() === "story-status");
      expect(command).toBeTruthy();
    });

    it("has correct options", () => {
      const command = program.commands.find((c) => c.name() === "story-status");
      expect(command?.options[0].long).toBe("--agent");
      expect(command?.options[1].long).toBe("--format");
      expect(command?.options[2].long).toBe("--status");
      expect(command?.options[3].long).toBe("--agent-status");
      expect(command?.options[4].long).toBe("--sort-by");
    });

    it("has correct description", () => {
      const command = program.commands.find((c) => c.name() === "story-status");
      expect(command?.description()).toBe("View story and agent status");
    });

    it("has correct default option values", () => {
      const command = program.commands.find((c) => c.name() === "story-status");
      const formatOption = command?.options.find((o) => o.long === "--format");
      expect(formatOption?.defaultValue).toBe("table");

      const sortByOption = command?.options.find((o) => o.long === "--sort-by");
      expect(sortByOption?.defaultValue).toBe("id");
    });
  });
});
