# TanStack Query & Table

Pairs with `lang-ts` and a framework rule (`fw-vue`, `fw-react`). Those name TanStack as the
server-state layer; this file is how to use it. Framework-agnostic — the packages differ
(`@tanstack/vue-query` / `@tanstack/react-query`, `-vue-table` / `-react-table`), the rules
below do not.

### Tooling
- Register the client **once**, at the composition root, next to the other plugins
  (`app.use(VueQueryPlugin)` / `<QueryClientProvider>`). One client per app, never per
  component.
- Add `@tanstack/table-core` as a **direct** dependency only when you augment `ColumnMeta` —
  the interface is declared there, and module augmentation against a transitive dependency
  breaks the moment the resolution changes.

### Query keys
- Keys mirror the read model, most general segment first: `[root, <resource>, <state>]`.
  That ordering is what makes `[root, resource]` a usable invalidation **prefix**, so one
  changed row refreshes every panel reading that resource whatever filters each applied.
- Build keys in **one place** (a `queryKeys.ts`), never inline at a call site — an
  ad-hoc key is a cache entry nothing else can find or invalidate.
- Every key segment must be plain JSON. TanStack hashes the key structurally, so a
  function, class instance or `ref` in a key silently collapses distinct queries onto one
  entry. Keep the state object free of callbacks by construction.
- Reactive input is a **getter** (`MaybeRefOrGetter`), and the key a `computed` over it, so
  changing a filter re-keys and refetches. Never read a `ref` into a key eagerly.

### Queries
- `staleTime` is a deliberate choice per query, not a default to inherit: set it from how
  often the underlying data can actually change (a nightly catalogue tolerates a minute; a
  job queue does not). Leaving it at 0 makes every keystroke a network call.
- Use `placeholderData: keepPreviousData` for anything paginated or typeahead-driven — the
  previous page stays on screen instead of flashing a spinner.
- `isPending` is "no data yet, ever"; `isFetching` is "a read is in flight". With
  `keepPreviousData`, `isPending` is false for every read after the first — endless scroll
  and refresh indicators want `isFetching`, and using the wrong one re-fires the request.
- The `queryFn` **throws** on failure. A client that reports errors in a return value
  (hey-api, some SDKs) must have that checked and rethrown, or every failure caches as a
  success.

### Mutations
- `mutate` over `mutateAsync` unless the caller genuinely awaits the result: `mutateAsync`
  rejects and needs a `try`/`catch` at every call site, while `onSuccess`/`onError` put the
  outcome where the UI already reads it from.
- Invalidate on success **only when the write changed rows the page shows**. A write that
  merely queues background work invalidates nothing — refetching the same unchanged page
  implies the work is done. Say so in a comment; a missing `invalidateQueries` reads as an
  oversight otherwise.
- Invalidate by the widest correct prefix, not by the exact key of the query you happen to
  be in.

### Live updates
- REST/PostgREST is the source of truth; a live channel (WebSocket, SSE, Realtime) **patches
  the cache**, it does not become a second one. A payload carrying the whole row →
  `setQueryData`; anything else → `invalidateQueries` on the prefix.
- Debounce invalidation on the **trailing** edge. Bursts are the normal case, and only the
  last change has a correct result — a read fired mid-burst is overwritten anyway.
- Tear the subscription down on scope disposal (`onScopeDispose` / effect cleanup), or a
  remounted panel accumulates channels.

### Table
- The table is **headless**: it owns sorting, pagination and row model; it renders nothing.
  Keep markup in components and never let a column definition return DOM.
- Sorting, filtering and pagination are either all server-side or all client-side for a
  given table. Mixed (client sort over a server page) sorts the visible slice only, which
  looks like a bug and is one.
- Put per-column display and filter configuration in an augmented `ColumnMeta` derived from
  a **single** source field, so the cell renderer and the query filter cannot disagree.
- Derive column headers from the column key; a hand-written label drifts from the schema on
  the next rename.

### Strong typing
- Type the query's **result**, not the composable's return: `useQuery<Page<Row>>` lets the
  data type flow outward on its own.
- Generate row types from the schema (OpenAPI, database types) — never hand-mirror a
  backend type. If a view's columns are nullable at the source, they are nullable here, and
  narrowing them is a filter with a reason, not a cast.
- Never type a `queryFn` as returning `any`; `undefined` is a legitimate result and `any`
  hides the difference between "empty" and "failed".
