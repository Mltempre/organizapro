import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Backup files — kept for reference, not production code
    "**/*.backup.tsx",
    "**/*.backup.ts",
    "**/*.backup.js",
    // Old utility scripts at repo root (CommonJS, not app code)
    "fix-*.js",
    "write-*.js",
    "confirm-user.js",
    "create-user.js",
  ]),
]);

export default eslintConfig;
