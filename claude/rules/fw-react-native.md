# React Native (Expo)

Pairs with `lang-ts` for TypeScript conventions, but **overrides its package manager**: Expo
apps use npm, not pnpm (see Tooling). This file adds only framework-specific conventions.

### Tooling
- Framework: **Expo** (SDK-managed) with **expo-router** for file-based routing
  (`main: expo-router/entry`). Prefer Expo over the bare React Native CLI.
- Package manager: **npm** (`package-lock.json`); pin via `"packageManager": "npm@<version>"`.
  Add SDK packages with `npx expo install <pkg>` (picks SDK-compatible versions) rather than
  raw `npm install`; never hand-edit `package.json` versions.
- Pin the Expo SDK and `react-native` together (they are coupled); pin `react`/`react-dom` to
  the SDK-required version. Keep `metro.config.js` and `babel.config.js` under version control.
- **Build locally, never EAS cloud builds:** use `expo run:android` / `expo run:ios` (local
  native Gradle/Xcode builds against a committed prebuild) and `expo start --dev-client`.

### Testing
- Runner: **Jest** with the `jest-expo` preset (`"jest": { "preset": "jest-expo" }`), plus
  React Native Testing Library (or `react-test-renderer`) for components. Run with `jest`
  (`jest --ci` in CI).
- Colocate unit tests or use `__tests__/`. Default to **unit tests**; add e2e (Detox/Maestro)
  only when explicitly requested. New code ships with tests.

### Linting
- Linter: **`expo lint`** (Expo's ESLint integration, `eslint-config-expo`); pair with
  Prettier. Lint passes clean — no disabled rules without a written reason.

### Enforcing (via git)
- Wire `expo lint`, `prettier --check`, `tsc --noEmit`, and `jest --ci` into a **pre-commit
  hook** under `.githooks/` that blocks on failure; enable with
  `git config core.hooksPath .githooks`. Keep gitleaks secret-scanning enforced.

### Strong typing
- TypeScript only, never plain JS/JSX. `tsconfig.json` extends `expo/tsconfig.base` with
  `"strict": true`; run `tsc --noEmit` as a blocking gate.
- Forbid `any` and `@ts-ignore` / `@ts-expect-error` without an inline justification.
- Type the native ↔ JS bridge explicitly (e.g. `declare class` for `requireNativeModule`
  results) so TS sees native methods.

For runtime performance work (FPS, re-renders, TTI, bundle size, memory, animations, Turbo
Modules) consult a dedicated React Native performance reference rather than guessing.
