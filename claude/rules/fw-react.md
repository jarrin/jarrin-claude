# React 19 (standalone, Vite)

Pairs with `lang-ts` (pnpm, strict TS, ESLint + Prettier, Vitest). This file adds only
the conventions for **standalone React 19** on **Vite** — an SPA, a component library, or
a bundle injected into a host page (a browser extension, a UI plugin). For React Native
use `fw-react-native`; for a Vue project use `fw-vue` / `fw-nuxtjs`. A meta-framework
(Next.js, Remix) owns its own routing, data and build conventions — this file does not
cover it.

### Tooling

- React 19 + `@vitejs/plugin-react` (or `-swc` for faster HMR on large apps), ESM
  (`type: "module"`). Scripts: `vite` (dev), `vite build`, `vite preview`.
- Function components and hooks only — no classes, no `forwardRef` boilerplate (React 19
  passes `ref` as a plain prop).
- Routing: **react-router** (`createBrowserRouter`, data routers) for an SPA. A bundle
  injected into a host page has no router — do not add one for a single view.
- Server state: **TanStack Query** — the same rule as `fw-vue`. Local UI state via
  `useState`/`useReducer`; `useContext` for genuinely app-wide values only (theme, session);
  reach for **Zustand** before Redux if a global client store is actually needed.
- Forms: **react-hook-form** + a **zod** resolver, so the schema types the form.

### Structure & mount

Group by **feature**, never by file type (`components/ hooks/ utils/` stops scaling at
about twenty files, because every change touches four directories):

```
src/
  app/            # composition root: entry, router, providers, global styles
  features/<name>/  # components, hooks, api, types, tests for ONE slice
  shared/         # ui/ primitives, lib/ helpers — zero product knowledge
```

- A feature owns everything it needs and exposes it through one `index.ts` barrel.
  Import `@/features/auth`, never `@/features/auth/components/LoginForm`.
- **Features never import each other.** Lift the shared part into `shared/`, or compose
  them in `app/`. Enforce it — `eslint-plugin-boundaries` or
  `import/no-restricted-paths` — a convention nobody lints is a convention nobody follows.
- The moment something in `shared/` knows a domain type, it belongs in a feature.
- One component per file, **PascalCase filename** matching the export; everything else
  camelCase. Colocate `*.test.tsx` next to the source.
- Alias `@/*` → `src/*` in **both** `tsconfig` `paths` and `vite.config.ts`
  `resolve.alias` — set one without the other and the build and type-check disagree.
- Mount through one path: `createRoot(el).render(<Providers><App /></Providers>)`.

### Styling (SCSS)

- **SCSS, not plain CSS**: add `sass-embedded` (dev dependency); Vite compiles `.scss`
  with no further config. Use `@use` / `@forward` — `@import` is deprecated in Sass.
- Default to **CSS Modules**: `Component.module.scss` colocated with its component, so
  class names are hashed and cannot collide. Reserve global stylesheets for resets,
  tokens, and third-party overrides.
- A bundle injected into a **foreign DOM** (extension, plugin) is the exception: it needs
  stable global class names to out-specify the host's CSS. There, use a namespaced BEM
  prefix (`.myplugin-thing__part--state`), write class names out **in full** rather than
  assembling them with `&__` / `&--`, and keep one explicit stylesheet manifest that fixes
  cascade order. Both matter because you debug those rules in someone else's DevTools.
- Shared values live in a variables-only partial (`styles/_tokens.scss`) that emits no
  CSS, so every consumer can `@use` it without duplicating rules into the bundle.
- Out-specify rather than reach for `!important` — an `!important` is unanswerable when a
  later rule legitimately needs to win.

### Testing

- **Vitest** + **React Testing Library** (`@testing-library/react`, `-jest-dom`,
  `-user-event`), `environment: "jsdom"`. Colocate `*.test.tsx`; default to unit tests, no
  e2e unless asked. New components ship with tests.
- Query by accessible role/label, not test ids or class names — a test that survives a
  refactor is the point. Drive interaction with `userEvent`, never raw `fireEvent`.

### Linting

- **`eslint-plugin-react-hooks`** with `react-hooks/rules-of-hooks` as an **error**: hook
  order is invisible at review time and fails at runtime.
- **`eslint-plugin-react`** (flat config) for template correctness. Turn `react/prop-types`
  **off** — TypeScript already types props, and runtime propTypes become a second,
  drifting source of truth. Set `settings.react.version` explicitly whenever React is not a
  resolvable dependency (e.g. borrowed from a host page).
- With the **automatic** JSX runtime (the default), turn `react/react-in-jsx-scope` off.
  With the **classic** runtime (`jsxFactory`), keep it on and also enable
  `react/jsx-uses-react`, or `no-unused-vars` strips the React import from files that only
  render JSX.
- Add `eslint-plugin-jsx-a11y` for anything user-facing.

### Strong typing

- Type props with an exported `interface <Name>Props`; let the return type infer. Prefer a
  plain function declaration over `React.FC` — since React 18 dropped implicit `children`,
  `React.FC` buys nothing and blocks generic components.
- Split the TS config the Vite way: `tsconfig.app.json` (browser libs, `src`) and
  `tsconfig.node.json` (`@types/node`, the config files), with a solution `tsconfig.json`
  holding `files: []` + `references`. Check both with **`tsc -b --noEmit`** — a plain
  `tsc --noEmit` against the solution file checks nothing. Keeping them apart is what stops
  Node globals being nameable in code that ships to a browser.
- `baseUrl` is deprecated in TS 6 — `paths` already resolves relative to its own tsconfig.
- Never type an event handler's argument as `any`; the DOM types are precise
  (`React.ChangeEvent<HTMLInputElement>`).

Verify API details against the docs for the installed React and router versions rather
than assuming — React's data/async APIs move fast.
