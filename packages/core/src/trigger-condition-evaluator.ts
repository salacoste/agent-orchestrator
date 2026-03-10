/**
 * Trigger Condition Evaluator
 *
 * Evaluates trigger conditions based on story attributes, events, and custom logic.
 * Supports AND/OR/NOT operators, debounce, and once-only firing.
 */

/** Story attributes available for trigger evaluation */
export interface StoryAttributes {
  /** Story ID (e.g., "story-1") */
  id: string;
  /** Story title */
  title?: string;
  /** Priority level */
  priority?: string;
  /** Story status */
  status?: string;
  /** Story points */
  points?: number;
  /** Tags associated with the story */
  tags?: string[];
  /** Additional custom attributes */
  [key: string]: unknown;
}

/** Event from Event Bus */
export interface EventAttributes {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event data payload */
  data: Record<string, unknown>;
}

/** Trigger definition from plugin.yaml or programmatic registration */
export interface TriggerDefinition {
  /** Unique trigger name */
  name: string;

  /** Trigger condition (story-based, event-based, or combined) */
  condition: TriggerCondition;

  /** Action to execute when trigger fires */
  action: string | ActionHandler;

  /** Debounce time in milliseconds (optional) */
  debounce?: number;

  /** Fire only once (optional) */
  once?: boolean;

  /** Plugin that owns this trigger */
  plugin?: string;
}

/** Action handler function type */
export type ActionHandler = (context: {
  story?: StoryAttributes;
  event?: EventAttributes;
}) => void | Promise<void>;

/** Trigger condition types */
export type TriggerCondition = SimpleCondition | AndCondition | OrCondition | NotCondition;

/** Simple condition (story, event, or time-based) */
export interface SimpleCondition {
  /** Story-based condition */
  story?: StoryCondition;

  /** Event-based condition */
  event?: EventCondition;

  /** Time-based condition */
  time?: TimeCondition;
}

/** Story condition with operators */
export interface StoryCondition {
  /** Story ID (exact match) */
  id?: string | StringOperator;

  /** Story title (with operators) */
  title?: string | StringOperator;

  /** Priority (exact match) */
  priority?: string | StringOperator;

  /** Status (exact match) */
  status?: string | StringOperator;

  /** Points (with operators) */
  points?: number | NumberOperator;

  /** Tags (AND logic - all must match) */
  tags?: string[] | TagOperator;
}

/** String operators */
export type StringOperator =
  | { eq: string }
  | { ne: string }
  | { contains: string }
  | { matches: string }; // regex

/** Number operators */
export type NumberOperator =
  | { eq: number }
  | { ne: number }
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number };

/** Tag operator */
export interface TagOperator {
  /** OR logic for tags - matches if any tag is present */
  any?: string[];
}

/** Event condition */
export interface EventCondition {
  /** Event type to match */
  type?: string | StringOperator;
}

/** Time condition */
export interface TimeCondition {
  /** Hour range (inclusive) */
  hour?: { start: number; end: number };

  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek?: number | number[];
}

/** AND condition - all sub-conditions must match */
export interface AndCondition {
  and: TriggerCondition[];
}

/** OR condition - at least one sub-condition must match */
export interface OrCondition {
  or: TriggerCondition[];
}

/** NOT condition - sub-condition must not match */
export interface NotCondition {
  not: TriggerCondition;
}

/** Result of trigger evaluation */
export interface TriggerResult {
  /** Whether the trigger matched */
  matches: boolean;

  /** Reason for match (for debugging) */
  reason?: string;

  /** Action to execute */
  action: string | ActionHandler;

  /** Plugin that owns this trigger */
  plugin?: string;
}

/** Trigger statistics */
export interface TriggerStats {
  /** Number of times trigger has fired */
  fireCount: number;

  /** Last fire timestamp */
  lastFired?: string;

  /** Name of the trigger */
  name: string;
}

/** Internal trigger record with metadata */
interface TriggerRecord {
  definition: TriggerDefinition;
  stats: TriggerStats;
  lastEvaluation?: number; // timestamp
  debounceTimer?: ReturnType<typeof setTimeout>;
  hasFired?: boolean; // for once=true
}

/** Trigger evaluator interface */
export interface TriggerEvaluator {
  /** Register triggers from plugin or configuration */
  register(triggers: TriggerDefinition[]): TriggerDefinition[];

  /** Evaluate triggers against a story
   *
   * @param story - Story attributes to evaluate against
   * @param triggerName - Optional specific trigger name. If provided, returns single result or undefined.
   * @returns Array of trigger results, or single result if triggerName specified
   */
  evaluateStory(story: StoryAttributes): TriggerResult[];
  evaluateStory(story: StoryAttributes, triggerName: string): TriggerResult | undefined;

  /** Evaluate triggers against an event
   *
   * @param event - Event attributes to evaluate against
   * @param triggerName - Optional specific trigger name. If provided, returns single result or undefined.
   * @returns Array of trigger results, or single result if triggerName specified
   */
  evaluateEvent(event: EventAttributes): TriggerResult[];
  evaluateEvent(event: EventAttributes, triggerName: string): TriggerResult | undefined;

  /** Get statistics for a trigger */
  getStats(triggerName: string): TriggerStats | undefined;

  /** List all registered triggers */
  listTriggers(): TriggerDefinition[];
}

/** Create a trigger condition evaluator */
export function createTriggerConditionEvaluator(): TriggerEvaluator {
  const triggers: Map<string, TriggerRecord> = new Map();

  function register(triggerDefs: TriggerDefinition[]): TriggerDefinition[] {
    for (const trigger of triggerDefs) {
      const record: TriggerRecord = {
        definition: trigger,
        stats: {
          fireCount: 0,
          name: trigger.name,
        },
      };

      triggers.set(trigger.name, record);
    }

    return triggerDefs;
  }

  function evaluateStory(
    story: StoryAttributes,
    triggerName?: string,
  ): TriggerResult[] | TriggerResult | undefined {
    const results: TriggerResult[] = [];

    for (const [name, record] of triggers.entries()) {
      if (triggerName && name !== triggerName) {
        continue;
      }

      const result = evaluateCondition(record.definition.condition, { story });

      if (result.matches) {
        // Check debounce
        if (record.definition.debounce) {
          const now = Date.now();
          if (record.lastEvaluation && now - record.lastEvaluation < record.definition.debounce) {
            // Debounced - still matches but don't fire
            if (triggerName) {
              return {
                matches: true,
                action: record.definition.action,
                plugin: record.definition.plugin,
                reason: `Trigger "${name}" is debounced`,
              };
            }
            continue;
          }
          record.lastEvaluation = now;
        }

        // Check once - don't fire again if already fired
        if (record.definition.once && record.hasFired) {
          if (triggerName) {
            return {
              matches: false,
              action: record.definition.action,
              plugin: record.definition.plugin,
              reason: `Trigger "${name}" already fired (once: true)`,
            };
          }
          results.push({
            matches: false,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" already fired (once: true)`,
          });
          continue;
        }

        // Update stats
        record.stats.fireCount++;
        record.stats.lastFired = new Date().toISOString();
        if (record.definition.once) {
          record.hasFired = true;
        }

        if (triggerName) {
          return {
            matches: true,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" fired for story ${story.id}`,
          };
        }
        results.push({
          matches: true,
          action: record.definition.action,
          plugin: record.definition.plugin,
          reason: `Trigger "${name}" fired for story ${story.id}`,
        });
      } else {
        // Condition didn't match - for specific trigger, return non-matching result
        if (triggerName) {
          return {
            matches: false,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" condition did not match`,
          };
        }
      }
    }

    // Return single result if triggerName was specified
    if (triggerName) {
      // Trigger not found - return undefined
      return undefined;
    }

    return results;
  }

  function evaluateEvent(
    event: EventAttributes,
    triggerName?: string,
  ): TriggerResult[] | TriggerResult | undefined {
    const results: TriggerResult[] = [];

    for (const [name, record] of triggers.entries()) {
      if (triggerName && name !== triggerName) {
        continue;
      }

      const result = evaluateCondition(record.definition.condition, { event });

      if (result.matches) {
        // Check debounce
        if (record.definition.debounce) {
          const now = Date.now();
          if (record.lastEvaluation && now - record.lastEvaluation < record.definition.debounce) {
            // Debounced - still matches but don't fire
            if (triggerName) {
              return {
                matches: true,
                action: record.definition.action,
                plugin: record.definition.plugin,
                reason: `Trigger "${name}" is debounced`,
              };
            }
            continue;
          }
          record.lastEvaluation = now;
        }

        // Check once - don't fire again if already fired
        if (record.definition.once && record.hasFired) {
          if (triggerName) {
            return {
              matches: false,
              action: record.definition.action,
              plugin: record.definition.plugin,
              reason: `Trigger "${name}" already fired (once: true)`,
            };
          }
          results.push({
            matches: false,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" already fired (once: true)`,
          });
          continue;
        }

        // Update stats
        record.stats.fireCount++;
        record.stats.lastFired = new Date().toISOString();
        if (record.definition.once) {
          record.hasFired = true;
        }

        if (triggerName) {
          return {
            matches: true,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" fired for event ${event.type}`,
          };
        }
        results.push({
          matches: true,
          action: record.definition.action,
          plugin: record.definition.plugin,
          reason: `Trigger "${name}" fired for event ${event.type}`,
        });
      } else {
        // Condition didn't match - for specific trigger, return non-matching result
        if (triggerName) {
          return {
            matches: false,
            action: record.definition.action,
            plugin: record.definition.plugin,
            reason: `Trigger "${name}" condition did not match`,
          };
        }
      }
    }

    // Return single result if triggerName was specified
    if (triggerName) {
      // Trigger not found - return undefined
      return undefined;
    }

    return results;
  }

  function evaluateCondition(
    condition: TriggerCondition,
    context: { story?: StoryAttributes; event?: EventAttributes },
  ): { matches: boolean } {
    // Simple condition
    if ("story" in condition || "event" in condition || "time" in condition) {
      return evaluateSimpleCondition(condition as SimpleCondition, context);
    }

    // AND condition
    if ("and" in condition) {
      const andCondition = condition as AndCondition;
      for (const cond of andCondition.and) {
        const result = evaluateCondition(cond, context);
        if (!result.matches) {
          return { matches: false };
        }
      }
      return { matches: true };
    }

    // OR condition
    if ("or" in condition) {
      const orCondition = condition as OrCondition;
      for (const cond of orCondition.or) {
        const result = evaluateCondition(cond, context);
        if (result.matches) {
          return { matches: true };
        }
      }
      return { matches: false };
    }

    // NOT condition
    if ("not" in condition) {
      const notCondition = condition as NotCondition;
      const result = evaluateCondition(notCondition.not, context);
      return { matches: !result.matches };
    }

    return { matches: false };
  }

  function evaluateSimpleCondition(
    condition: SimpleCondition,
    context: { story?: StoryAttributes; event?: EventAttributes },
  ): { matches: boolean } {
    // Evaluate all conditions - all must match (AND logic)

    // Story condition
    const storyMatches =
      !condition.story || !context.story
        ? true
        : evaluateStoryCondition(condition.story, context.story).matches;

    // Event condition
    const eventMatches =
      !condition.event || !context.event
        ? true
        : evaluateEventCondition(condition.event, context.event).matches;

    // Time condition
    const timeMatches = condition.time ? evaluateTimeCondition(condition.time).matches : true;

    // All conditions must match
    return { matches: storyMatches && eventMatches && timeMatches };
  }

  function evaluateStoryCondition(
    condition: StoryCondition,
    story: StoryAttributes,
  ): { matches: boolean } {
    // Check ALL specified conditions - all must match (AND logic)

    // ID match
    if (condition.id !== undefined) {
      if (isStringOperator(condition.id)) {
        if (!matchStringOperator(story.id, condition.id)) {
          return { matches: false };
        }
      } else if (story.id !== condition.id) {
        return { matches: false };
      }
    }

    // Title match
    if (condition.title !== undefined) {
      if (story.title === undefined) {
        return { matches: false };
      }
      if (isStringOperator(condition.title)) {
        if (!matchStringOperator(story.title, condition.title)) {
          return { matches: false };
        }
      } else if (story.title !== condition.title) {
        return { matches: false };
      }
    }

    // Priority match
    if (condition.priority !== undefined) {
      if (story.priority === undefined) {
        return { matches: false };
      }
      if (isStringOperator(condition.priority)) {
        if (!matchStringOperator(story.priority, condition.priority)) {
          return { matches: false };
        }
      } else if (story.priority !== condition.priority) {
        return { matches: false };
      }
    }

    // Status match
    if (condition.status !== undefined) {
      if (story.status === undefined) {
        return { matches: false };
      }
      if (isStringOperator(condition.status)) {
        if (!matchStringOperator(story.status, condition.status)) {
          return { matches: false };
        }
      } else if (story.status !== condition.status) {
        return { matches: false };
      }
    }

    // Points match
    if (condition.points !== undefined) {
      if (story.points === undefined) {
        return { matches: false };
      }
      if (isNumberOperator(condition.points)) {
        if (!matchNumberOperator(story.points, condition.points)) {
          return { matches: false };
        }
      } else if (story.points !== condition.points) {
        return { matches: false };
      }
    }

    // Tags match
    if (condition.tags !== undefined) {
      const tagResult = evaluateTagsCondition(condition.tags, story.tags || []);
      if (!tagResult.matches) {
        return tagResult;
      }
    }

    return { matches: true }; // All conditions passed
  }

  function evaluateEventCondition(
    condition: EventCondition,
    event: EventAttributes,
  ): { matches: boolean } {
    if (condition.type === undefined) {
      return { matches: true };
    }

    if (isStringOperator(condition.type)) {
      return { matches: matchStringOperator(event.type, condition.type) };
    }

    return { matches: event.type === condition.type };
  }

  function evaluateTimeCondition(condition: TimeCondition): { matches: boolean } {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Check hour condition if specified
    const hourMatches = condition.hour
      ? hour >= condition.hour.start && hour <= condition.hour.end
      : true;

    // Check day of week condition if specified
    const dayMatches =
      condition.dayOfWeek !== undefined
        ? (Array.isArray(condition.dayOfWeek)
            ? condition.dayOfWeek
            : [condition.dayOfWeek]
          ).includes(day)
        : true;

    // Both conditions must match if both are specified
    return { matches: hourMatches && dayMatches };
  }

  function evaluateTagsCondition(
    condition: string[] | TagOperator,
    storyTags: string[],
  ): { matches: boolean } {
    if (Array.isArray(condition)) {
      // AND logic - all tags must be present
      return {
        matches: condition.every((tag) => storyTags.includes(tag)),
      };
    }

    if (condition.any) {
      // OR logic - at least one tag must match
      return {
        matches: condition.any.some((tag) => storyTags.includes(tag)),
      };
    }

    return { matches: false };
  }

  function isStringOperator(value: unknown): value is StringOperator {
    return (
      typeof value === "object" &&
      value !== null &&
      ("eq" in value || "ne" in value || "contains" in value || "matches" in value)
    );
  }

  function isNumberOperator(value: unknown): value is NumberOperator {
    return (
      typeof value === "object" &&
      value !== null &&
      ("eq" in value ||
        "ne" in value ||
        "gt" in value ||
        "gte" in value ||
        "lt" in value ||
        "lte" in value)
    );
  }

  function matchStringOperator(actual: string, operator: StringOperator): boolean {
    if ("eq" in operator) {
      return actual === operator.eq;
    }
    if ("ne" in operator) {
      return actual !== operator.ne;
    }
    if ("contains" in operator) {
      return actual.includes(operator.contains);
    }
    if ("matches" in operator) {
      const regex = new RegExp(operator.matches);
      return regex.test(actual);
    }
    return false;
  }

  function matchNumberOperator(actual: number, operator: NumberOperator): boolean {
    if ("eq" in operator) {
      return actual === operator.eq;
    }
    if ("ne" in operator) {
      return actual !== operator.ne;
    }
    if ("gt" in operator) {
      return actual > operator.gt;
    }
    if ("gte" in operator) {
      return actual >= operator.gte;
    }
    if ("lt" in operator) {
      return actual < operator.lt;
    }
    if ("lte" in operator) {
      return actual <= operator.lte;
    }
    return false;
  }

  function getStats(triggerName: string): TriggerStats | undefined {
    const record = triggers.get(triggerName);
    return record?.stats;
  }

  function listTriggers(): TriggerDefinition[] {
    return Array.from(triggers.values()).map((r) => r.definition);
  }

  return {
    register,
    evaluateStory: evaluateStory as TriggerEvaluator["evaluateStory"],
    evaluateEvent: evaluateEvent as TriggerEvaluator["evaluateEvent"],
    getStats,
    listTriggers,
  };
}
