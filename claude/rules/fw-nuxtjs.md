# Nuxt.js (Nuxt 4)

Pairs with `lang-ts` (pnpm, ESLint + Prettier, strict TS). This file adds only
framework-specific conventions.

### Tooling
- Nuxt 4 (`nuxt@^4`), ESM (`type: "module"`). Scripts: `nuxt dev`, `nuxt build`,
  `nuxt generate` (prerender), `nuxt preview`; run `nuxt prepare` in `postinstall` to
  generate `.nuxt/` types and configs.
- Configure in `nuxt.config.ts` via `defineNuxtConfig({...})`; set a `compatibilityDate` and
  `devtools: { enabled: true }`. Choose rendering with `ssr: true|false`.
- Common general modules: `@nuxt/eslint`, `@nuxt/ui`, `@vueuse/nuxt`.
- Env values through `runtimeConfig` (`runtimeConfig.public` for browser-exposed, overridable
  by `NUXT_*`). Proxy a backend in dev with `nitro.devProxy`.

### Structure & conventions
- App code under `app/` (`app/components/`, `app/composables/`, `app/pages/`, `app/assets/`,
  `app/types/`); server code under `server/`; static files under `public/`.
- Components, composables, and utilities are **auto-imported**; extend via
  `imports: { dirs: [...] }`. Exclude large/generated type files from auto-import and import
  them explicitly.
- Data fetching: `useFetch` / `useAsyncData` (or `$fetch` for imperative calls). SSR-safe
  shared state via `useState`; reusable logic in `app/composables/`.

### Linting
- ESLint via `@nuxt/eslint`: import `withNuxt(...)` from the generated `.nuxt/eslint.config.mjs`
  in the project's `eslint.config.mjs` and add overrides (e.g. `ignores` for generated code).
  Turn off ESLint stylistic rules (`eslint: { config: { stylistic: false } }`) so Prettier
  owns formatting.

### Strong typing
- `tsconfig.json` just `extends: "./.nuxt/tsconfig.json"` — the generated Nuxt config is
  already strict; don't redefine compiler options.
- Type check with `nuxt typecheck` (wraps `vue-tsc`), after `nuxt prepare` has generated
  `.nuxt/`. If framework typecheck is flaky in an environment, `pnpm lint` plus the runtime
  is the reliable gate — but keep `tsc`/`vue-tsc` in CI.
