import { describe, expect, it } from "vitest";

import { AGENT_PROFILES, recommendProfile } from "../agent-profiles";

describe("AGENT_PROFILES", () => {
  it("defines 3 profiles", () => {
    expect(AGENT_PROFILES).toHaveLength(3);
  });

  it("each profile has required fields", () => {
    for (const p of AGENT_PROFILES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.validationFrequency).toBe("number");
      expect(typeof p.testCoverageThreshold).toBe("number");
      expect(typeof p.securityChecks).toBe("boolean");
    }
  });
});

describe("recommendProfile", () => {
  it("recommends careful profile for high-complexity stories", () => {
    const recs = recommendProfile({ complexity: 5, domains: ["core"], securitySensitive: false });
    expect(recs[0].profile.id).toBe("careful");
  });

  it("recommends speed profile for low-complexity stories", () => {
    const recs = recommendProfile({ complexity: 1, domains: ["ui"], securitySensitive: false });
    expect(recs[0].profile.id).toBe("speed");
  });

  it("recommends security profile for security-sensitive stories", () => {
    const recs = recommendProfile({ complexity: 3, domains: ["auth"], securitySensitive: true });
    // Security or careful should be top (both have securityChecks: true)
    expect(recs[0].profile.securityChecks).toBe(true);
  });

  it("penalizes speed profile for security-sensitive stories", () => {
    const recs = recommendProfile({ complexity: 3, domains: ["auth"], securitySensitive: true });
    const speedRec = recs.find((r) => r.profile.id === "speed");
    expect(speedRec!.score).toBeLessThan(50); // Penalized below base
  });

  it("returns all 3 profiles ranked by score", () => {
    const recs = recommendProfile({ complexity: 3, domains: [], securitySensitive: false });
    expect(recs).toHaveLength(3);
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score);
    expect(recs[1].score).toBeGreaterThanOrEqual(recs[2].score);
  });

  it("includes reason for each recommendation", () => {
    const recs = recommendProfile({ complexity: 5, domains: [], securitySensitive: true });
    for (const r of recs) {
      expect(r.reason).toBeTruthy();
    }
  });
});
