import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep Next's generated files out of lint while adding project-generated outputs.
  globalIgnores([
    ".next/**",
    ".trigger/**",
    "agent/dist/**",
    "out/**",
    "build/**",
    "lib/generated/**",
    "next-env.d.ts",
    "context/talkt/**",
  ]),
]);

export default eslintConfig;
