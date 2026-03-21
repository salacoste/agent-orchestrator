import { describe, expect, it } from "vitest";

import { parseAgentManifest } from "../parse-agents";

const VALID_HEADER = "name,displayName,title,icon,capabilities,role";

function makeCsv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join("\n");
}

describe("parseAgentManifest", () => {
  it("parses a single valid row", () => {
    const csv = makeCsv([
      "analyst,Analyst,Business Analyst,magnifying-glass,analysis,Analyzes requirements",
    ]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "analyst",
      displayName: "Analyst",
      title: "Business Analyst",
      icon: "magnifying-glass",
      role: "Analyzes requirements",
    });
  });

  it("parses multiple rows", () => {
    const csv = makeCsv([
      "analyst,Analyst,Business Analyst,magnifying-glass,analysis,Analyzes requirements",
      "architect,Architect,Solution Architect,building,design,Designs systems",
    ]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("analyst");
    expect(result[1].name).toBe("architect");
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = makeCsv([
      '"pm","Product Manager","PM, Lead","clipboard","planning, coordination","Manages product roadmap, priorities"',
    ]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Product Manager");
    expect(result[0].title).toBe("PM, Lead");
    expect(result[0].role).toBe("Manages product roadmap, priorities");
  });

  it("skips rows with fewer than 6 fields", () => {
    const csv = makeCsv(["incomplete,row,only,three"]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(0);
  });

  it("skips rows with empty name", () => {
    const csv = makeCsv([",Some Display,Title,icon,caps,role"]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(0);
  });

  it("skips rows with empty displayName", () => {
    const csv = makeCsv(["name,,Title,icon,caps,role"]);
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for header-only CSV", () => {
    const result = parseAgentManifest(VALID_HEADER);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const result = parseAgentManifest("");
    expect(result).toEqual([]);
  });

  it("returns empty array for single line (no data rows)", () => {
    const result = parseAgentManifest("just-a-header-line");
    expect(result).toEqual([]);
  });

  it("ignores blank lines", () => {
    const csv = VALID_HEADER + "\n\nanalyst,Analyst,BA,icon,caps,role\n\n";
    const result = parseAgentManifest(csv);
    expect(result).toHaveLength(1);
  });

  it("skips capabilities column (index 4)", () => {
    const csv = makeCsv(["a,b,c,d,SHOULD_BE_SKIPPED,role_value"]);
    const result = parseAgentManifest(csv);
    expect(result[0].role).toBe("role_value");
    // capabilities should not appear in the result
    expect(Object.values(result[0])).not.toContain("SHOULD_BE_SKIPPED");
  });

  it("trims whitespace from fields", () => {
    const csv = makeCsv(["  analyst , Analyst , Business Analyst , icon , caps , role "]);
    const result = parseAgentManifest(csv);
    expect(result[0].name).toBe("analyst");
    expect(result[0].displayName).toBe("Analyst");
  });
});
