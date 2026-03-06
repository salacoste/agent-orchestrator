import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".js"],
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 10000,
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 8,
      },
    },
  },
});
