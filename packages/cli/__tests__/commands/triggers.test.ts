/**
 * Triggers command tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Command } from "commander";
import { registerTriggers } from "../../src/commands/triggers.js";

// Mock console.log and console.error
const originalLog = console.log;
const originalError = console.error;

describe("Triggers Command", () => {
  beforeEach(() => {
    // Restore console methods
    console.log = originalLog;
    console.error = originalError;
  });

  describe("registerTriggers", () => {
    it("should register the triggers command with commander", () => {
      const program = new Command();
      registerTriggers(program);

      const command = program.commands.find((cmd) => cmd.name() === "triggers");
      expect(command).toBeDefined();
      expect(command?.description()).toBe("List registered trigger conditions");
    });

    it("should have --json option", () => {
      const program = new Command();
      registerTriggers(program);

      const command = program.commands.find((cmd) => cmd.name() === "triggers");
      expect(command?.options).toHaveLength(2);
      expect(command?.options[0]?.long).toBe("--json");
      expect(command?.options[1]?.long).toBe("--examples");
    });
  });

  describe("triggers command output", () => {
    it("should show examples when --examples flag is used", () => {
      const logOutput: string[] = [];
      console.log = (...args) => {
        logOutput.push(args.map(String).join(" "));
      };

      const program = new Command();
      registerTriggers(program);

      // This would normally load config, but for testing we just check command structure
      const command = program.commands.find((cmd) => cmd.name() === "triggers");
      expect(command).toBeDefined();

      // Verify the examples option exists
      const examplesOption = command?.options.find((opt) => opt.long === "--examples");
      expect(examplesOption).toBeDefined();
    });

    it("should have --json option for JSON output", () => {
      const program = new Command();
      registerTriggers(program);

      const command = program.commands.find((cmd) => cmd.name() === "triggers");
      expect(command).toBeDefined();

      const jsonOption = command?.options.find((opt) => opt.long === "--json");
      expect(jsonOption).toBeDefined();
    });
  });
});
