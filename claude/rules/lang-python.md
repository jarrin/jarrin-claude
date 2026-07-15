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
- Wire `ruff check .`, `ruff format --check .`, `mypy`, and `pytest` into a **pre-commit
  hook** under `.githooks/` that blocks on failure; enable with
  `git config core.hooksPath .githooks`. Keep gitleaks secret-scanning enforced.

### Strong typing
- Type checker: **mypy** in `strict` mode. Run `poetry run mypy <package> tests`; scope with
  `files = ["<package>", "tests"]` and `python_version = "3.11"`.
- Full annotations required. No `# type: ignore` without a written reason; no untyped `Any`
  back doors.
- For a stubless third-party lib, do not disable typing globally — confine the untyped import
  to one adapter module and add a scoped `[[tool.mypy.overrides]]` with
  `ignore_missing_imports = true` and a comment justifying it. Prefer `types-*` stub packages
  where they exist.
