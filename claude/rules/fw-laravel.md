# Laravel

Pairs with `lang-php` (Composer, Pest, Pint, PHPStan/Larastan). This file adds only
framework-specific conventions.

### Conventions
- **Consistency first:** match the pattern the codebase already uses; the rules below are
  defaults only when no pattern exists.
- Follow Laravel naming conventions everywhere. Prefer framework helpers (`Str`, `Arr`,
  `Number`, `$request->string()`) and `mb_*` over raw PHP.
- Constructor dependency injection over the `app()` helper.
- Single-purpose **Action** classes; keep controller methods short — extract to
  actions/services. No JS/CSS in Blade, no HTML in PHP classes.
- Routing: implicit route-model binding (scoped for nested resources), `Route::resource()` /
  `apiResource()`, and type-hinted **Form Requests** for automatic validation.

### Eloquent & migrations
- Correct relationship types with return-type hints; local scopes for reusable constraints.
- Attribute casts in the `casts()` method; cast date columns to Carbon.
- Eager-load with `with()` to avoid N+1; enable `Model::preventLazyLoading()` in dev; select
  only needed columns; use `chunkById()` / `cursor()` for large sets; never query in Blade.
- Migrations: `constrained()` for FKs, add indexes in the migration, reversible `down()`,
  one concern per migration; never modify a migration already run in production.

### Validation
- Form Request classes over inline validation; array-notation rules (`['required', 'email']`).
- Use `$request->validated()` — never `$request->all()`.

### Testing idioms
- `LazilyRefreshDatabase` over `RefreshDatabase`. Prefer `assertModelExists()` and factory
  states/sequences over manual overrides.
- Use fakes (`Event::fake()`, `Http::fake()` + `preventStrayRequests()`) after factory setup.
- Assert `assertQueued()` (not `assertSent()`) for queued mailables/notifications.

### Security & robustness
- Define `$fillable` or `$guarded` on every model; authorize every action via policies/gates.
- No raw SQL with user input; `@csrf` on state-changing routes; `throttle` on auth/API routes;
  validate upload MIME, extension, and size; `encrypted` cast for sensitive fields.
- `Cache::remember()` / `Cache::lock()` over manual get/put. Queued jobs: `retry_after` >
  job `timeout`, exponential backoff, `ShouldBeUnique` where relevant, always implement
  `failed()`. HTTP client: explicit `timeout`, `retry()` with backoff, check status or
  `throw()`.
- `env()` only inside config files — read everything else through `config()`.

Verify exact API syntax against the docs for the installed Laravel version rather than
assuming.
