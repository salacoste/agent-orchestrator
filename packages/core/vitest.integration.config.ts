import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["**/__tests__/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
    hookTimeout: 10000,
    alias: {
      // Integration tests import real plugins. These aliases resolve
      // package names to source files so we don't need circular devDeps
      // (plugins depend on core, core can't depend on plugins).
      "@composio/ao-plugin-tracker-github": resolve(
        __dirname,
        "../plugins/tracker-github/src/index.ts",
      ),
      "@composio/ao-plugin-scm-github": resolve(__dirname, "../plugins/scm-github/src/index.ts"),
    },
    // Integration tests may need longer timeouts
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
