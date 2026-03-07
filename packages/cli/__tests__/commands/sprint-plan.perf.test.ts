import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";

const cliPath = join(__dirname, "../../dist/index.js");
const testDir = join(__dirname, "temp-perf-test");

describe("sprint-plan performance benchmarks", () => {
  beforeAll(() => {
    // Create temp directory for performance tests
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup temp directory
    if (existsSync(testDir)) {
      unlinkSync(join(testDir, "sprint-status.yaml"));
    }
  });

  it("completes within 500ms for 100-story file", () => {
    // Generate a sprint-status.yaml with 100 stories
    const developmentStatus: Record<string, string> = {};
    developmentStatus["epic-1"] = "in-progress";

    for (let i = 1; i <= 100; i++) {
      const epicNum = Math.ceil(i / 20);
      const storyNum = ((i - 1) % 20) + 1;
      developmentStatus[`${epicNum}-${storyNum}-perf-test-story-${i}`] = "ready-for-dev";
    }

    const yamlContent = `
generated: 2026-03-06
project: perf-test
project_key: NOKEY
tracking_system: file-system
story_location: .

development_status:
${Object.entries(developmentStatus)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join("\n")}
`;

    writeFileSync(join(testDir, "sprint-status.yaml"), yamlContent, "utf-8");

    const startTime = Date.now();
    const result = spawnSync("node", [cliPath, "sprint-plan"], {
      cwd: testDir,
      encoding: "utf-8",
    });

    const elapsed = Date.now() - startTime;

    expect(result.status).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });

  it("scales linearly with story count", () => {
    const sizes = [10, 25, 50];
    const times: number[] = [];

    for (const size of sizes) {
      const developmentStatus: Record<string, string> = {};
      for (let i = 1; i <= size; i++) {
        developmentStatus[`1-${i}-test-story`] = "ready-for-dev";
      }

      const yamlContent = `
generated: 2026-03-06
project: perf-test
development_status:
${Object.entries(developmentStatus)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join("\n")}
`;

      writeFileSync(join(testDir, "sprint-status.yaml"), yamlContent, "utf-8");

      const startTime = Date.now();
      spawnSync("node", [cliPath, "sprint-plan"], {
        cwd: testDir,
        encoding: "utf-8",
      });
      const elapsed = Date.now() - startTime;
      times.push(elapsed);
    }

    // Verify linear scaling (50 stories should take roughly 5x longer than 10 stories)
    // Allow 10x tolerance for system variance
    const ratio10to50 = times[2] / times[0];
    expect(ratio10to50).toBeLessThan(10); // Should be ~5x but allow up to 10x
  });
});
