/**
 * NLU Parser — natural language command parsing (Story 47.3).
 *
 * Pattern matching (not LLM) for common orchestration commands.
 * Returns ranked intents with extracted parameters.
 */

/** Recognized action types. */
export type NLUAction = "spawn" | "kill" | "status" | "resume" | "list" | "show" | "fallback";

/** Parsed intent. */
export interface NLUIntent {
  action: NLUAction;
  params: Record<string, string>;
  confidence: number;
  description: string;
}

/** Pattern rule for matching. */
interface PatternRule {
  pattern: RegExp;
  action: NLUAction;
  extractParams: (match: RegExpMatchArray) => Record<string, string>;
  describe: (params: Record<string, string>) => string;
  confidence: number;
}

/** Pattern rules ordered by specificity. */
const RULES: PatternRule[] = [
  {
    pattern: /\b(?:spawn|start|create|run)\b.*?\b(?:for|on)\s+(.+)/i,
    action: "spawn",
    extractParams: (m) => ({ storyId: m[1].trim() }),
    describe: (p) => `Spawn agent for ${p.storyId}`,
    confidence: 0.9,
  },
  {
    pattern: /\b(?:spawn|start|create|run)\s+(?:an?\s+)?(?:agent|session)\b/i,
    action: "spawn",
    extractParams: () => ({}),
    describe: () => "Spawn a new agent",
    confidence: 0.7,
  },
  {
    pattern: /\b(?:kill|stop|terminate)\s+(.+)/i,
    action: "kill",
    extractParams: (m) => ({ agentId: m[1].trim() }),
    describe: (p) => `Kill agent ${p.agentId}`,
    confidence: 0.9,
  },
  {
    pattern: /\b(?:resume|restart|continue)\s+(.+)/i,
    action: "resume",
    extractParams: (m) => ({ agentId: m[1].trim() }),
    describe: (p) => `Resume agent ${p.agentId}`,
    confidence: 0.9,
  },
  {
    pattern: /\b(?:show|list|display)\s+(?:all\s+)?(?:blocked)\b/i,
    action: "show",
    extractParams: () => ({ filter: "blocked" }),
    describe: () => "Show blocked stories",
    confidence: 0.9,
  },
  {
    pattern: /\b(?:show|list|display)\s+(?:all\s+)?(\w+)/i,
    action: "list",
    extractParams: (m) => ({ type: m[1].toLowerCase() }),
    describe: (p) => `List ${p.type}`,
    confidence: 0.7,
  },
  {
    pattern: /\bstatus\b/i,
    action: "status",
    extractParams: () => ({}),
    describe: () => "Show sprint status",
    confidence: 0.8,
  },
  {
    pattern: /\bblocked\b/i,
    action: "show",
    extractParams: () => ({ filter: "blocked" }),
    describe: () => "Show blocked stories",
    confidence: 0.6,
  },
];

/**
 * Parse a natural language command into ranked intents.
 *
 * Returns all matching intents sorted by confidence (highest first).
 * If no matches, returns a single fallback intent.
 *
 * Pure function — no I/O, no LLM.
 */
export function parseCommand(input: string): NLUIntent[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [{ action: "fallback", params: {}, confidence: 0, description: "Empty command" }];
  }

  const matches: NLUIntent[] = [];

  for (const rule of RULES) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      const params = rule.extractParams(match);
      matches.push({
        action: rule.action,
        params,
        confidence: rule.confidence,
        description: rule.describe(params),
      });
    }
  }

  // Deduplicate by action (keep highest confidence)
  const byAction = new Map<string, NLUIntent>();
  for (const intent of matches) {
    const key = `${intent.action}:${JSON.stringify(intent.params)}`;
    const existing = byAction.get(key);
    if (!existing || intent.confidence > existing.confidence) {
      byAction.set(key, intent);
    }
  }

  const deduped = [...byAction.values()].sort((a, b) => b.confidence - a.confidence);

  if (deduped.length === 0) {
    return [
      {
        action: "fallback",
        params: { input: trimmed },
        confidence: 0,
        description: `Unrecognized command: "${trimmed}"`,
      },
    ];
  }

  return deduped;
}
