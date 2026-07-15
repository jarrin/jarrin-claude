# PHP

### Tooling
- Package manager: **Composer**. Add/update/remove packages via the CLI only — never
  hand-edit versions in `composer.json`:
  - `composer require <pkg>` / `composer require --dev <pkg>`
  - `composer update <pkg>` (or bare `composer update` to refresh the lockfile)
  - `composer remove <pkg>`
- Commit `composer.lock`.
- Pin the runtime: declare `"php": "^8.3"` (or newer) in `require`.
- Wrap the toolchain in Composer scripts (`lint`, `format`, `analyse`, `test`, `check`) so
  contributors run one word instead of raw binaries.

### Testing
- Runner: **Pest** (on top of PHPUnit). Run the suite with `composer test`
  (→ `php artisan test`), or directly `vendor/bin/pest`.
- Tests live in `tests/Unit` and `tests/Feature`. Default to **unit tests**; no e2e unless
  explicitly requested.
- Force isolation in the test env: `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`,
  `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, `MAIL_MAILER=array`. New code ships with tests.

### Linting
- Formatter: **Laravel Pint** (`laravel` preset).
  - Check (fail on diff): `vendor/bin/pint --test`
  - Auto-fix: `vendor/bin/pint`
- Use `exclude` / `notPath` in `pint.json` to skip generated code. Lint passes clean — no
  disabled rules without a written reason.

### Enforcing (via git)
- Wire Pint (`--test`), PHPStan, and Pest into a **pre-commit hook** under `.githooks/` that
  blocks the commit on failure; enable with `git config core.hooksPath .githooks`.
- Provide an aggregate gate `composer check` = `lint` + `analyse` + `test`; keep the tree
  green. Keep gitleaks secret-scanning enforced.

### Strong typing
- `declare(strict_types=1);` at the top of every PHP file; type all properties, parameters,
  and return values.
- Static analysis: **PHPStan** (via **Larastan**) at **max level** in pre-commit / CI. Set
  `level: max` and `checkModelProperties: true`; keep zero errors over the baseline.
- Forbid `mixed` and untyped signatures unless justified in an inline comment.
