import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      ".claude/**",
      "packages/web/next-env.d.ts",
      "packages/web/next.config.js",
      "packages/web/postcss.config.mjs",
      "test-clipboard*.mjs",
      "test-clipboard*.sh",
      "packages/mobile/**",
    ],
  },

  // Base JS rules
  eslint.configs.recommended,

  // TypeScript strict rules
  ...tseslint.configs.strict,

  // Prettier compat (disables formatting rules)
  eslintConfigPrettier,

  // Project-wide rules
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Security: prevent shell injection patterns
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // Code quality
      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-template-curly-in-string": "warn",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-require-imports": "error",
    },
  },

  // Relaxed rules for test files
  {
    files: ["**/*.test.ts", "**/__tests__/**"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // CLI package uses console.log/error for user output
  {
    files: ["packages/cli/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Relaxed rules for Next.js pages/components
  {
    files: ["packages/web/**/*.tsx", "packages/web/**/*.ts"],
    rules: {
      "no-console": "off", // Next.js uses console for server logs
    },
  },

  // Story 24.1: Prevent node:* imports in client-side web components.
  // Next.js webpack bundles the ENTIRE module graph when a client component
  // imports from a module that imports node:fs (even transitively). This
  // caused build failures in Cycle 4 Stories 16.1 and 18.4.
  {
    files: [
      "packages/web/src/components/**/*.tsx",
      "packages/web/src/components/**/*.ts",
      "packages/web/src/hooks/**/*.ts",
      // Note: page.tsx/layout.tsx are server components by default in App Router
      // and CAN use node:* imports. Only "use client" pages would be a problem,
      // but those are rare and caught by Next.js build errors.
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*"],
              message:
                "Node.js builtins cannot be imported in client components (breaks Next.js bundle). Use server-side API routes instead.",
            },
          ],
        },
      ],
    },
  },

  // Scripts directory - Node.js environment
  {
    files: ["scripts/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-console": "off", // Scripts use console for output
    },
  },
);
