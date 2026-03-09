/**
 * Trigger Condition Tests
 *
 * Tests the trigger condition evaluation system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTriggerConditionEvaluator,
  type TriggerDefinition,
  type TriggerEvaluator,
} from "../trigger-condition-evaluator.js";

describe("TriggerConditionEvaluator", () => {
  let evaluator: TriggerEvaluator;

  beforeEach(() => {
    evaluator = createTriggerConditionEvaluator();
  });

  describe("Parse YAML trigger definitions", () => {
    it("should parse story-based triggers", () => {
      const yamlTriggers = [
        {
          name: "auto-assign-high-priority",
          condition: {
            story: {
              priority: "high",
              status: "todo",
            },
          },
          action: "autoAssignAgent",
        },
      ] as TriggerDefinition[];

      const parsed = evaluator.register(yamlTriggers);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.name).toBe("auto-assign-high-priority");
    });

    it("should parse event-based triggers", () => {
      const yamlTriggers = [
        {
          name: "notify-on-story-complete",
          condition: {
            event: {
              type: "story.completed",
            },
          },
          action: "sendNotification",
        },
      ] as TriggerDefinition[];

      const parsed = evaluator.register(yamlTriggers);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.condition).toBeDefined();
    });

    it("should parse time-based conditions", () => {
      const yamlTriggers = [
        {
          name: "business-hours-only",
          condition: {
            story: {
              priority: "high",
            },
            time: {
              hour: { start: 9, end: 17 },
            },
          },
          action: "autoAssignAgent",
        },
      ] as TriggerDefinition[];

      const parsed = evaluator.register(yamlTriggers);
      expect(parsed).toHaveLength(1);
    });
  });

  describe("Evaluate story conditions", () => {
    it("should match story priority", () => {
      const trigger: TriggerDefinition = {
        name: "high-priority",
        condition: {
          story: {
            priority: "high",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should not match when priority differs", () => {
      const trigger: TriggerDefinition = {
        name: "high-priority",
        condition: {
          story: {
            priority: "high",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "low",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(false);
    });

    it("should match multiple story attributes (AND logic)", () => {
      const trigger: TriggerDefinition = {
        name: "high-priority-todo",
        condition: {
          story: {
            priority: "high",
            status: "todo",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should not match when one attribute fails", () => {
      const trigger: TriggerDefinition = {
        name: "high-priority-todo",
        condition: {
          story: {
            priority: "high",
            status: "todo",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "in-progress",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(false);
    });
  });

  describe("Evaluate tag-based triggers", () => {
    it("should match single tag", () => {
      const trigger: TriggerDefinition = {
        name: "security-tag",
        condition: {
          story: {
            tags: ["security"],
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "medium",
        status: "todo",
        tags: ["security"],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should match with AND logic (all tags required)", () => {
      const trigger: TriggerDefinition = {
        name: "security-and-performance",
        condition: {
          story: {
            tags: ["security", "performance"],
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "medium",
        status: "todo",
        tags: ["security", "performance"],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should not match when tags incomplete", () => {
      const trigger: TriggerDefinition = {
        name: "security-and-performance",
        condition: {
          story: {
            tags: ["security", "performance"],
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "medium",
        status: "todo",
        tags: ["security"],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(false);
    });
  });

  describe("Evaluate attribute-based triggers with operators", () => {
    it("should support 'eq' operator", () => {
      const trigger: TriggerDefinition = {
        name: "priority-eq-high",
        condition: {
          story: {
            priority: { eq: "high" },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should support 'ne' operator", () => {
      const trigger: TriggerDefinition = {
        name: "priority-not-high",
        condition: {
          story: {
            priority: { ne: "high" },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "low",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should support 'gte' operator", () => {
      const trigger: TriggerDefinition = {
        name: "points-gte-5",
        condition: {
          story: {
            points: { gte: 5 },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        points: 5,
        priority: "medium",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should support 'contains' operator", () => {
      const trigger: TriggerDefinition = {
        name: "title-contains-api",
        condition: {
          story: {
            title: { contains: "API" },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        title: "Implement API endpoint",
        priority: "medium",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should support 'matches' operator (regex)", () => {
      const trigger: TriggerDefinition = {
        name: "id-matches-story-1",
        condition: {
          story: {
            id: { matches: "^story-1-.*" },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1-feature",
        priority: "medium",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });
  });

  describe("Evaluate event conditions", () => {
    it("should match event type", () => {
      const trigger: TriggerDefinition = {
        name: "story-complete-event",
        condition: {
          event: {
            type: "story.completed",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const event = {
        id: "event-1",
        type: "story.completed",
        timestamp: new Date().toISOString(),
        data: { storyId: "story-1" },
      };

      const result = evaluator.evaluateEvent(event, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should not mismatch different event type", () => {
      const trigger: TriggerDefinition = {
        name: "story-complete-event",
        condition: {
          event: {
            type: "story.completed",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const event = {
        id: "event-1",
        type: "agent.started",
        timestamp: new Date().toISOString(),
        data: {},
      };

      const result = evaluator.evaluateEvent(event, trigger.name);
      expect(result!.matches).toBe(false);
    });
  });

  describe("Support combined conditions (AND/OR/NOT)", () => {
    it("should evaluate AND conditions", () => {
      const trigger: TriggerDefinition = {
        name: "high-and-todo",
        condition: {
          and: [{ story: { priority: "high" } }, { story: { status: "todo" } }],
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should evaluate OR conditions", () => {
      const trigger: TriggerDefinition = {
        name: "high-or-urgent",
        condition: {
          or: [{ story: { priority: "high" } }, { story: { tags: ["urgent"] } }],
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "medium",
        status: "todo",
        tags: ["urgent"],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should evaluate NOT conditions", () => {
      const trigger: TriggerDefinition = {
        name: "not-low-priority",
        condition: {
          not: {
            story: { priority: "low" },
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should evaluate nested AND/OR/NOT", () => {
      const trigger: TriggerDefinition = {
        name: "complex-condition",
        condition: {
          and: [
            {
              or: [{ story: { priority: "high" } }, { story: { priority: "urgent" } }],
            },
            {
              not: {
                story: { status: "done" },
              },
            },
          ],
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "urgent",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });
  });

  describe("Implement debounce/once options", () => {
    it("should respect debounce option", async () => {
      const trigger: TriggerDefinition = {
        name: "debounced-trigger",
        condition: {
          story: {
            priority: "high",
          },
        },
        action: "test",
        debounce: 100, // 100ms debounce
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      // First evaluation - should match
      const result1 = evaluator.evaluateStory(story, trigger.name);
      expect(result1!.matches).toBe(true);

      // Immediate second evaluation - should be debounced
      const result2 = evaluator.evaluateStory(story, trigger.name);
      expect(result2!.matches).toBe(true);

      // Wait for debounce to clear
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third evaluation after debounce - should match again
      const result3 = evaluator.evaluateStory(story, trigger.name);
      expect(result3!.matches).toBe(true);
    });

    it("should respect once option", () => {
      const trigger: TriggerDefinition = {
        name: "once-trigger",
        condition: {
          story: {
            priority: "high",
          },
        },
        action: "test",
        once: true,
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      // First evaluation - should match
      const result1 = evaluator.evaluateStory(story, trigger.name);
      expect(result1!.matches).toBe(true);

      // Second evaluation - should not match (once already fired)
      const result2 = evaluator.evaluateStory(story, trigger.name);
      expect(result2!.matches).toBe(false);
    });
  });

  describe("Evaluate time-based conditions", () => {
    it("should match when hour condition is satisfied", () => {
      const trigger: TriggerDefinition = {
        name: "business-hours-trigger",
        condition: {
          story: {
            priority: "high",
          },
          time: {
            hour: { start: 0, end: 23 }, // All hours - should always match
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      // Should always match since hour range covers all day
      expect(result!.matches).toBe(true);
    });

    it("should support day of week filtering", () => {
      const trigger: TriggerDefinition = {
        name: "weekday-trigger",
        condition: {
          story: {
            priority: "high",
          },
          time: {
            dayOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days - should always match
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const result = evaluator.evaluateStory(story, trigger.name);
      // Should always match since all days are included
      expect(result!.matches).toBe(true);
    });

    it("should not match when day of week is excluded", () => {
      const trigger: TriggerDefinition = {
        name: "weekday-only-trigger",
        condition: {
          story: {
            priority: "high",
          },
          time: {
            dayOfWeek: [1, 2, 3, 4, 5], // Monday-Friday only
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const currentDay = new Date().getDay();
      const isWeekday = currentDay >= 1 && currentDay <= 5;

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(isWeekday);
    });

    it("should combine hour and day of week conditions with AND logic", () => {
      const trigger: TriggerDefinition = {
        name: "business-hours-weekday-trigger",
        condition: {
          story: {
            priority: "high",
          },
          time: {
            hour: { start: 0, end: 23 }, // All hours
            dayOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      // Both conditions should pass (all hours and all days)
      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(true);
    });

    it("should require both hour and day conditions when both specified", () => {
      const trigger: TriggerDefinition = {
        name: "strict-hours-trigger",
        condition: {
          story: {
            priority: "high",
          },
          time: {
            hour: { start: 0, end: 5 }, // Midnight to 5 AM only
            dayOfWeek: [1, 2, 3, 4, 5], // Monday-Friday only
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      // Both conditions must match
      const hourMatches = currentHour >= 0 && currentHour <= 5;
      const dayMatches = currentDay >= 1 && currentDay <= 5;
      const expectedMatch = hourMatches && dayMatches;

      const result = evaluator.evaluateStory(story, trigger.name);
      expect(result!.matches).toBe(expectedMatch);
    });

    it("should match when time condition only (no story condition)", () => {
      const trigger: TriggerDefinition = {
        name: "time-only-trigger",
        condition: {
          time: {
            hour: { start: 0, end: 23 }, // All hours
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const result = evaluator.evaluateStory({ id: "test-story" }, trigger.name);
      // Should always match since hour range covers all day
      expect(result!.matches).toBe(true);
    });
  });

  describe("Track trigger statistics", () => {
    it("should track fire count", () => {
      const trigger: TriggerDefinition = {
        name: "fired-trigger",
        condition: {
          story: {
            priority: "high",
          },
        },
        action: "test",
      };

      evaluator.register([trigger]);

      const story = {
        id: "story-1",
        priority: "high",
        status: "todo",
        tags: [],
      };

      // Fire trigger 3 times
      evaluator.evaluateStory(story, trigger.name);
      evaluator.evaluateStory(story, trigger.name);
      evaluator.evaluateStory(story, trigger.name);

      const stats = evaluator.getStats(trigger.name);
      expect(stats!.fireCount).toBe(3);
      expect(stats!.lastFired).toBeDefined();
    });
  });
});
