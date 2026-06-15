import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.react-router/**",
      "**/playwright-report/**",
      "**/test-results/**",
      // shadcn/ui primitives are vendored upstream code
      "frontend/app/components/ui/**",
    ],
  },

  // ---------- Backend: Node + ESM JavaScript ----------
  {
    files: ["backend/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      // Express error middleware needs a 4th arg it may not use
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  // ---------- Frontend: React + TypeScript ----------
  {
    files: ["frontend/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    settings: { react: { version: "19.1" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "react/prop-types": "off",
    },
  },

  // Bootstrap and CLI scripts: stdout logging is the point.
  {
    files: ["backend/index.js", "backend/seeds/**"],
    rules: { "no-console": "off" },
  },

  // ---------- Root-level config files (plain JS) ----------
  {
    files: ["*.js"],
    languageOptions: { globals: { ...globals.node } },
  },

  prettier
);
