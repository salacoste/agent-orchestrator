/**
 * Agent personality profiles (Stories 26.2 + 26.3).
 *
 * Defines configurable agent profiles (Careful, Speed, Security)
 * and story-agent matching based on story characteristics.
 */

/** An agent personality profile. */
export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  /** How often to run validation (1=every change, 5=every 5th change). */
  validationFrequency: number;
  /** Minimum test coverage threshold (0-100). */
  testCoverageThreshold: number;
  /** Whether to run security checks. */
  securityChecks: boolean;
}

/** Built-in agent profiles. */
export const AGENT_PROFILES: readonly AgentProfile[] = [
  {
    id: "careful",
    name: "Careful",
    description: "Extra validation, runs tests frequently, slower but fewer errors",
    validationFrequency: 1,
    testCoverageThreshold: 90,
    securityChecks: true,
  },
  {
    id: "speed",
    name: "Speed",
    description: "Minimal checks, fast iteration, good for prototyping",
    validationFrequency: 5,
    testCoverageThreshold: 60,
    securityChecks: false,
  },
  {
    id: "security",
    name: "Security",
    description: "Runs security checks, validates inputs, strict error handling",
    validationFrequency: 2,
    testCoverageThreshold: 80,
    securityChecks: true,
  },
];

/** Story characteristics for matching. */
export interface StoryCharacteristics {
  /** Estimated complexity (1-5). */
  complexity: number;
  /** Domain tags (e.g., "auth", "api", "ui"). */
  domains: string[];
  /** Whether story touches security-sensitive code. */
  securitySensitive: boolean;
}

/** A profile recommendation with score. */
export interface ProfileRecommendation {
  profile: AgentProfile;
  score: number;
  reason: string;
}

/**
 * Recommend the best agent profile for a story.
 */
export function recommendProfile(characteristics: StoryCharacteristics): ProfileRecommendation[] {
  const recommendations: ProfileRecommendation[] = [];

  for (const profile of AGENT_PROFILES) {
    let score = 50; // Base score
    let reason = "Default match";

    if (characteristics.securitySensitive && profile.securityChecks) {
      score += 30;
      reason = "Security-sensitive story matches security-enabled profile";
    }

    if (characteristics.complexity >= 4 && profile.id === "careful") {
      score += 25;
      reason = "High complexity story benefits from careful validation";
    }

    if (characteristics.complexity <= 2 && profile.id === "speed") {
      score += 25;
      reason = "Low complexity story benefits from fast iteration";
    }

    if (characteristics.securitySensitive && !profile.securityChecks) {
      score -= 20;
      reason = "Security-sensitive story needs security checks";
    }

    recommendations.push({ profile, score, reason });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}
