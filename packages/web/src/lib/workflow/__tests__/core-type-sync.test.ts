/**
 * Cross-package type sync test.
 *
 * Core defines canonical BMAD artifact types (Phase, PHASES, PHASE_LABELS, etc.).
 * Web duplicates them locally to avoid pulling node:fs into the Next.js bundle.
 * This test ensures the two copies stay in sync.
 */
import { describe, expect, it } from "vitest";

import * as coreTypes from "@composio/ao-core";

import { PHASES as WEB_PHASES, PHASE_LABELS as WEB_PHASE_LABELS } from "../types.js";

describe("core ↔ web type sync", () => {
  it("PHASES arrays must be identical", () => {
    expect([...WEB_PHASES]).toEqual([...coreTypes.PHASES]);
  });

  it("PHASE_LABELS must match for every phase", () => {
    for (const phase of coreTypes.PHASES) {
      expect(WEB_PHASE_LABELS[phase]).toBe(coreTypes.PHASE_LABELS[phase]);
    }
  });

  it("PHASE_LABELS must have same number of entries", () => {
    expect(Object.keys(WEB_PHASE_LABELS).length).toBe(Object.keys(coreTypes.PHASE_LABELS).length);
  });
});
