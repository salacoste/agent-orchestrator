/**
 * Vitest Configuration for CLI Integration Tests
 *
 * Separate config for integration tests allows:
 * - Different timeout settings for subprocess execution
 * - Isolated test environment from unit tests
 * - CLI-specific test reporters
 *
 * Run integration tests with: pnpm test --config vitest.integration.config.ts
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".js"],
  },
  test: {
    // Only run integration tests
    include: ["__tests__/integration/**/*.test.ts"],
    // Exclude unit tests
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "**/__tests__/commands/**", // exclude unit tests
      "**/__tests__/lib/**", // exclude unit tests
    ],
    // Integration tests need longer timeout (subprocess execution)
    testTimeout: 60000, // 60 seconds for CLI subprocess tests
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4, // Fewer threads for subprocess-heavy tests
      },
    },
    // Setup files for integration test environment
    setupFiles: [],
    // Include only integration test helpers in coverage
    includeSource: ["packages/cli/src/**/*.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Include all CLI source in coverage
      include: ["packages/cli/src/**"],
      // Exclude test helpers from coverage
      exclude: ["**/__tests__/**", "**/dist/**", "**/node_modules/**"],
    },
  },
});
