// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Config/build files run under Node without the app's tsconfig type info.
    // `scripts/*.mjs` are plain build helpers, deliberately outside the app's
    // tsconfig `include` — type-aware rules have no project to resolve them
    // against, so they are linted for correctness only.
    files: ["*.config.ts", "eslint.config.mjs", "scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // The build helpers are Node programs, not app code: without the app's
    // tsconfig there are no ambient `@types/node` globals, so declare the two
    // they use rather than pulling in a globals package for it.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  prettier,
);
