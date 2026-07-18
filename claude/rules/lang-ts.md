# TypeScript

TypeScript over plain JavaScript, always.

### Tooling
- Package manager: **pnpm**. Add/update/remove via the CLI only — never hand-edit versions
  in `package.json`:
  - `pnpm add <pkg>` / `pnpm add -D <pkg>`
  - `pnpm remove <pkg>`
  - `pnpm update <pkg>` (or `pnpm up`)
  - `pnpm dlx <pkg>` for one-off tool runs
- Pin the toolchain with the `"packageManager": "pnpm@<version>"` field (Corepack). Use the
  current Node LTS. Commit `pnpm-lock.yaml`.
- For a **monorepo**, use pnpm workspaces (`pnpm-workspace.yaml`, `workspace:*` deps) and a task
  runner — **turbo** (`turbo run <task>` with a `turbo.json` pipeline) — to fan lint/typecheck/
  test/build across packages.

### Testing
- Runner: **Vitest**. Run with `pnpm vitest run` (add a `test` script); watch with
  `pnpm vitest`.
- Colocate `*.test.ts` next to the code (or under `tests/`). Default to **unit tests**; no
  e2e unless explicitly requested. New code ships with tests.

### Linting
- Linter: **ESLint** (flat config — `eslint.config.mjs`, or `eslint.config.ts` when you want a
  typed config, loaded via `jiti`). Formatter: **Prettier**.
  - `eslint .` (check) / `eslint . --fix`
  - `prettier --write .` (or `--check` in CI)
- Let Prettier own formatting and ESLint own correctness. Exclude generated code via
  `ignores` / `.prettierignore`. Lint passes clean — no disabled rules without a reason.

### Enforcing (via git)
- Wire `eslint .`, `prettier --check .`, `tsc --noEmit`, and `vitest run` into a
  **pre-commit hook** under `.githooks/` that blocks on failure; enable with
  `git config core.hooksPath .githooks`. Keep gitleaks secret-scanning enforced.
- Wrapping the whole gate behind one aggregate command (a `task check` / turbo target the hook
  calls) is fine — and preferred in a monorepo — as long as it runs every step above and blocks
  on the first failure.

### Strong typing
- `tsconfig.json` in `strict` mode. Type check with `tsc --noEmit`.
- No implicit or explicit `any`; no `@ts-ignore` / `@ts-expect-error` without an inline
  justification comment. Never loosen a type just to make a build pass.
- Keep hand-maintained type mirrors in sync with their source of truth; exclude generated
  type files from linting but still type-check against them.
