/**
 * Agent manifest CSV parser (Gap WD-G2).
 *
 * Parses _bmad/_config/agent-manifest.csv with inline quoted-field
 * handling. No external CSV library — ~20 lines of parsing logic.
 */

import type { AgentInfo } from "./types";

/**
 * Parse a single CSV line, handling quoted fields with embedded commas.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse agent manifest CSV content into AgentInfo entries.
 *
 * Expected CSV columns: name, displayName, title, icon, capabilities, role, ...
 * We extract only: name (0), displayName (1), title (2), icon (3), role (5).
 *
 * @param csvContent  Raw CSV file content (including header row)
 * @returns Array of parsed agents; malformed rows are skipped
 */
export function parseAgentManifest(csvContent: string): AgentInfo[] {
  const lines = csvContent.split("\n").filter((line) => line.trim() !== "");

  if (lines.length < 2) return []; // Need at least header + one data row

  // Skip header row (line 0)
  const agents: AgentInfo[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);

    // Need at least 6 fields (name, displayName, title, icon, capabilities, role)
    if (fields.length < 6) continue;

    const name = fields[0];
    const displayName = fields[1];
    const title = fields[2];
    const icon = fields[3];
    const role = fields[5]; // Skip capabilities (index 4)

    // Skip rows with empty required fields
    if (!name || !displayName) continue;

    agents.push({ name, displayName, title, icon, role });
  }

  return agents;
}
