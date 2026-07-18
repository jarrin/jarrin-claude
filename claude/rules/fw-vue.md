# Vue 3 + Nuxt UI (standalone, Vite)

Pairs with `lang-ts` (pnpm, strict TS, ESLint + Prettier, Vitest). This file adds only the
conventions for **standalone Vue 3** — an SPA, a shared UI library, or an embedded host (e.g.
a browser-extension page) built on **Vite**, *not* the Nuxt framework. For the Nuxt framework
(SSR, `nuxt.config.ts`, server routes) use `fw-nuxtjs` instead. Nuxt **UI** is a component
library and works in both worlds; needing it is not a reason to pull in the whole framework.

### Tooling
- Vue 3 **SFC** with `<script setup lang="ts">`. Build with **Vite** + `@vitejs/plugin-vue`
  (SFCs precompiled — CSP-clean, no runtime template compilation).
- Components: **Nuxt UI v4** (Tailwind v4 + Reka UI). Wire the `@nuxt/ui/vite` plugin in the
  Vite config and register `@nuxt/ui/vue-plugin` at mount (`app.use(ui)`). Each host keeps its
  own Tailwind entry (the `@source` scan is host-relative).
- Data fetching: **TanStack Vue Query** (`@tanstack/vue-query`, `app.use(VueQueryPlugin)`) —
  REST is the source of truth; a live channel (WS/SSE) patches the cache (`setQueryData` /
  `invalidateQueries`). Reusable logic goes in composables (`use*`).

### `@nuxt/ui/vite` plugin options (decide once, house style)
- `router: false` when the host has no `vue-router` — links render as plain `<a>`.
- `autoImport`: choose explicit imports for **composables** (`autoImport: false`) or auto; keep
  it consistent across the workspace.
- **Component** auto-import is normally kept on — it stays fully typed via the generated
  `components.d.ts` (gitignored). Explicit `<U…>` imports need the raw `@nuxt/ui/components/*.vue`
  path behind the `#build/ui` virtual, which is fragile.
- In a monorepo, `scanPackages: ['@scope/pkg', …]` makes the component resolver reach into other
  workspace packages' SFCs so their `<U…>` usage resolves in the host build.

### Structure & mount
- SFCs under `components/`, composables under `composables/` (or a `data/` layer), a typed
  registry for pluggable sections. Mount through **one** path per app:
  `createApp(Root).use(ui).use(VueQueryPlugin).mount(root)` — a shared library exposes a single
  `mount(root, opts)` so multiple hosts mount the same shell.

### Strong typing
- Typecheck `.vue` with **`vue-tsc --noEmit`**, never plain `tsc` (it can't parse SFCs). `vue-tsc`
  is the type source of truth for SFCs, incl. Nuxt UI component props.
- Nuxt UI's `#build/ui/*` theme virtuals are generated into `node_modules/.nuxt-ui/` by the Vite
  plugin at **build/dev** time. Map `paths: { "#build/*": ["./node_modules/.nuxt-ui/*"] }` in
  `tsconfig.json` and run a build/dev **once** before typechecking so component prop types
  resolve. A package checked in isolation (no host build) runs in Volar's loose mode — the host's
  `vue-tsc` is where those props get their real types.

### Linting
- **`eslint-plugin-vue`** `flat/recommended` owns template correctness; `vue-eslint-parser` parses
  the SFC and delegates `<script>` to the typescript-eslint parser.
- `.vue` is **not** type-aware-linted: typescript-eslint's project service is not Volar, so it
  can't resolve `defineProps`/`defineEmits` macros and every type-aware rule misfires on them.
  Apply `tseslint.configs.disableTypeChecked` to `**/*.vue` — `eslint-plugin-vue` + the
  non-type-aware TS rules cover the script, and `vue-tsc` owns the types. Turn off
  `vue/multi-word-component-names` where host roots are legitimately named `App.vue`.
