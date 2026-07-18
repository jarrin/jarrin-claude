# Python

### Tooling
- Package manager: **Poetry**. Add/update/remove via the CLI only — never hand-edit versions
  in `pyproject.toml`:
  - `poetry add <pkg>` / `poetry add --group dev <pkg>`
  - `poetry update` (regenerates the lockfile)
  - `poetry remove <pkg>`
  - `poetry install`; run tools inside the venv with `poetry run <cmd>`.
- Commit `poetry.lock`. Pin the runtime: `requires-python = ">=3.11,<4.0"`.

### Testing
- Runner: **pytest**. Run with `poetry run pytest`. Tests live in a top-level `tests/`
  directory (`testpaths = ["tests"]`).
- Default to **unit tests**; no e2e unless explicitly requested. New code ships with tests.
- For async code add `pytest-asyncio` and set `asyncio_mode = "auto"` so plain
  `async def test_*` runs without a per-test marker.

### Linting
- Linter + formatter: **Ruff**.
  - `poetry run ruff check .` (check; `--fix` to autofix)
  - `poetry run ruff format .`
- Configure under `[tool.ruff]`; `extend-exclude` for vendored / non-owned code. Lint passes
  clean — no disabled rules without a written reason.

### Enforcing (via git)
- Wire `ruff check .`, `ruff format --check .`, `basedpyright`, and `pytest` into a **pre-commit
  hook** under `.githooks/` that blocks on failure; enable with
  `git config core.hooksPath .githooks`. Keep gitleaks secret-scanning enforced.
- Wrapping the whole gate behind one aggregate command (a `task check` / `composer check`-style
  target the hook calls) is fine — and preferred in a monorepo — as long as it runs every step
  above and blocks on the first failure.

### Strong typing
- Type checker: **basedpyright** in `strict` mode. Run `poetry run basedpyright`. Set
  `typeCheckingMode = "strict"` under `[tool.basedpyright]` and promote the `Any`-guards to
  errors: `reportAny`, `reportExplicitAny`, `reportMissingTypeStubs`, `reportImplicitOverride`;
  pin `pythonVersion` to the project's runtime. (basedpyright over mypy: `reportAny` closes the
  untyped-`Any` hole mypy leaves open — it is the rule that matters.)
- Full annotations required (ruff `ANN`, incl. `ANN401` — no `Any` in annotations). No
  `# pyright: ignore[<rule>]` (or `# type: ignore`) without a rule code and a written reason;
  no untyped `Any` back doors.
- For a stubless third-party lib, do not loosen typing globally — confine the untyped import to
  one adapter module that validates the value into a typed model (e.g. a pydantic model), and
  scope a `# pyright: ignore[reportMissingTypeStubs]` with a justifying comment. Prefer `types-*`
  stub packages where they exist. Exclude generated code via `exclude` (the parallel of ruff's
  `extend-exclude`).
