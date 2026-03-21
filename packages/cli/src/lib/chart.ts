/**
 * ASCII Burndown Chart Renderer
 *
 * Renders a burndown chart as an array of terminal lines with:
 * - Y-axis: story count (or points), auto-scaled
 * - X-axis: day numbers
 * - Ideal line: dashed (- -)
 * - Actual line: solid (━)
 */

import type { BurndownResult } from "@composio/ao-core";

/** Characters used in chart rendering */
const ACTUAL_CHAR = "━";
const IDEAL_CHAR = "╌";
const BOTH_CHAR = "╋";
const AXIS_V = "│";
const AXIS_H = "─";
const CORNER_BL = "└";

/**
 * Render a burndown chart as an array of strings (one per line).
 *
 * @param result - BurndownResult from burndown service
 * @param termWidth - Terminal width (default: process.stdout.columns or 80)
 * @returns Array of lines ready for console.log
 */
export function renderBurndownChart(result: BurndownResult, termWidth?: number): string[] {
  const width = Math.max(60, termWidth ?? process.stdout.columns ?? 80);
  const data = result.dailyData;

  if (data.length === 0) {
    return ["  No burndown data available."];
  }

  const maxVal =
    result.totalStories > 0
      ? result.totalStories
      : Math.max(...data.map((d) => Math.max(d.remaining, d.idealRemaining)));
  if (maxVal === 0) {
    return ["  No stories in sprint."];
  }

  // Chart dimensions
  const labelWidth = String(maxVal).length + 1; // Y-axis label width
  const chartWidth = Math.min(width - labelWidth - 3, data.length * 3); // 3 chars per day
  const chartHeight = Math.min(20, maxVal); // max 20 rows

  const lines: string[] = [];

  // Build chart grid row by row (top to bottom)
  for (let row = chartHeight; row >= 0; row--) {
    const yValue = Math.round((row / chartHeight) * maxVal);
    const yLabel =
      row % 4 === 0 || row === chartHeight
        ? String(yValue).padStart(labelWidth)
        : " ".repeat(labelWidth);

    let rowChars = "";
    for (let col = 0; col < data.length && col < Math.floor(chartWidth / 3); col++) {
      const d = data[col];
      const actualRow = Math.round((d.remaining / maxVal) * chartHeight);
      const idealRow = Math.round((d.idealRemaining / maxVal) * chartHeight);

      let ch = "  ";
      if (actualRow === row && idealRow === row) {
        ch = BOTH_CHAR + " ";
      } else if (actualRow === row) {
        ch = ACTUAL_CHAR + ACTUAL_CHAR;
      } else if (idealRow === row) {
        ch = IDEAL_CHAR + " ";
      }
      rowChars += ch + " ";
    }

    lines.push(`${yLabel} ${row === 0 ? CORNER_BL : AXIS_V}${rowChars}`);
  }

  // X-axis line
  const axisLine =
    " ".repeat(labelWidth + 1) + CORNER_BL + AXIS_H.repeat(Math.min(data.length * 3, chartWidth));
  lines.push(axisLine);

  // X-axis day labels
  let dayLabels = " ".repeat(labelWidth + 2);
  for (let i = 0; i < data.length && i < Math.floor(chartWidth / 3); i++) {
    dayLabels += String(i + 1).padEnd(3);
  }
  lines.push(dayLabels + " Days");

  // Legend
  lines.push("");
  lines.push(`  ${ACTUAL_CHAR}${ACTUAL_CHAR} Actual   ${IDEAL_CHAR} ${IDEAL_CHAR} Ideal`);

  return lines;
}
