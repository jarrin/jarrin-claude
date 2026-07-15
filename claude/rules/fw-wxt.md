# WXT (browser extension, Manifest V3)

Pairs with `lang-ts` (pnpm, strict TS, Prettier). This file adds only framework-specific
conventions for the **WXT** MV3 extension framework (Vite + TypeScript).

### Tooling
- `wxt@^0.20+`, ESM (`type: "module"`). Scripts: `wxt` (dev + live-reload →
  `.output/chrome-mv3-dev`) as `pnpm dev`, `wxt build` (→ `.output/chrome-mv3`), `wxt zip`,
  and `wxt prepare` in `postinstall` (generates `.wxt/` types + auto-import declarations).
- Configure in `wxt.config.ts` via `defineConfig({...})`. Author the **manifest** there under
  `manifest: {}` (name, `permissions`, `host_permissions`) — not a hand-written
  `manifest.json`.
- Auto-import a shared dir with `imports: { dirs: ['lib'] }`; WXT also auto-imports
  `defineBackground`, `defineContentScript`, and `storage`. Re-run `wxt prepare` if
  auto-import types go missing.

### Entrypoints & structure
- WXT auto-discovers `entrypoints/`:
  - `background.ts` → `defineBackground(() => {...})` (MV3 service worker).
  - `*.content.ts` → `defineContentScript({ matches, cssInjectionMode: 'ui', main(ctx) {...} })`.
  - HTML UI pages (`popup/`, `options/`) as folders with `index.html` + `main.ts`.
- Storage: the auto-imported `storage` API with typed area-prefixed keys (`local:<key>`);
  subscribe/watch to react to changes.
- Content-script UI: inject isolated UI via `cssInjectionMode: 'ui'` + `createShadowRootUi`
  (shadow DOM); re-attach to dynamic nodes with a `MutationObserver`; prefer reading the DOM
  over synthesizing events.
- Request the **minimal** `permissions` and explicit `host_permissions` per target origin.

### Strong typing
- `tsconfig.json` just `extends: "./.wxt/tsconfig.json"` — don't redefine. Type check with
  `tsc --noEmit` (after `wxt prepare`).
- Use the auto-imported promise-based, typed **`browser`** global (webextension-polyfill)
  rather than the untyped `chrome.*` API (`@types/chrome` only for `chrome.*`-only APIs like
  `chrome.offscreen`).

### MV3 caveats
- The background service worker is suspended after ~30s idle, dropping long-lived sockets. For
  a persistent connection use an **offscreen document** (`chrome.offscreen`) or keep the
  worker alive with `chrome.alarms`; wrap socket setup in try/catch.
- A top-level `import` that touches `window`/`document` at module-evaluation time breaks SW
  registration (`Status code: 15`) even with runtime try/catch — import worker-safe builds in
  the background entry.
