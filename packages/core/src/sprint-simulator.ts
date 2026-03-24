/**
 * Sprint simulator — Monte Carlo engine (Story 48.1).
 *
 * Pure function. Simulates sprint outcomes by sampling story durations
 * from historical data and computing percentile completion estimates.
 */

import type { SessionLearning } from "./types.js";

/** A story in the simulation backlog. */
export interface SimStory {
  id: string;
  domainTags: string[];
}

/** Simulation input. */
export interface SimulationInput {
  stories: SimStory[];
  learnings: SessionLearning[];
  iterations: number;
  sprintEndMs?: number;
  defaultDurationMs?: number;
  seed?: number;
}

/** Simulation result. */
export interface SimulationResult {
  p50Days: number;
  p80Days: number;
  p95Days: number;
  onTimeProbability: number;
  confidence: number;
  iterationsRun: number;
}

/** Default story duration when no historical data (4 hours). */
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;

/** Milliseconds per day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Simple seeded LCG random number generator (deterministic for tests).
 * Returns a function that produces numbers in [0, 1).
 */
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x80000000;
  };
}

/**
 * Run a Monte Carlo sprint simulation.
 *
 * Pure function — no I/O, deterministic with seed.
 */
export function simulateSprint(input: SimulationInput): SimulationResult {
  const {
    stories,
    learnings,
    iterations,
    sprintEndMs,
    defaultDurationMs = DEFAULT_DURATION_MS,
    seed = Date.now(),
  } = input;

  if (stories.length === 0 || iterations <= 0) {
    return {
      p50Days: 0,
      p80Days: 0,
      p95Days: 0,
      onTimeProbability: 1,
      confidence: 0,
      iterationsRun: 0,
    };
  }

  const rng = createRng(seed);
  const totals: number[] = [];

  // Pre-compute matching completed learnings per story (avoids re-filtering in hot loop)
  const completedLearnings = learnings.filter((l) => l.outcome === "completed");
  const storyMatches: SessionLearning[][] = stories.map((story) => {
    const domainSet = new Set(story.domainTags);
    return completedLearnings.filter((l) => l.domainTags.some((tag) => domainSet.has(tag)));
  });
  const storiesWithMatch = storyMatches.filter((m) => m.length > 0).length;

  // Run iterations — sample from pre-computed matches
  for (let i = 0; i < iterations; i++) {
    let totalMs = 0;
    for (const matches of storyMatches) {
      if (matches.length === 0) {
        totalMs += defaultDurationMs;
      } else {
        totalMs += matches[Math.floor(rng() * matches.length)].durationMs;
      }
    }
    totals.push(totalMs);
  }

  totals.sort((a, b) => a - b);

  const p50Days = Math.round((totals[Math.floor(iterations * 0.5)] / MS_PER_DAY) * 10) / 10;
  const p80Days = Math.round((totals[Math.floor(iterations * 0.8)] / MS_PER_DAY) * 10) / 10;
  const p95Days = Math.round((totals[Math.floor(iterations * 0.95)] / MS_PER_DAY) * 10) / 10;

  // On-time probability
  let onTimeProbability = 1;
  if (sprintEndMs) {
    const onTimeCount = totals.filter((t) => t <= sprintEndMs).length;
    onTimeProbability = Math.round((onTimeCount / iterations) * 100) / 100;
  }

  // Confidence: ratio of stories with matching data
  const confidence = Math.round((storiesWithMatch / stories.length) * 100) / 100;

  return {
    p50Days,
    p80Days,
    p95Days,
    onTimeProbability,
    confidence,
    iterationsRun: iterations,
  };
}
