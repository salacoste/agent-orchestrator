/**
 * Vitest Configuration for Performance Tests (Story 2-1-6)
 *
 * Runs performance tests that validate NFRs.
 * These tests measure actual vs target performance.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/performance/**/*.test.ts"],
    testTimeout: 60000, // Performance tests may take longer
    hookTimeout: 30000,
    reporters: ["verbose"],
    globals: true,
  },
});
