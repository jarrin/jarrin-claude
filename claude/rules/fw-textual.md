# Textual (Python TUI)

Pairs with `lang-python` (Poetry, pytest, Ruff, mypy strict). This file adds only
framework-specific conventions.

### Tooling
- Add with `poetry add textual` and `poetry add --group dev textual-dev`.
- Dev loop with hot reload: `textual run --dev <app>.py`. Debug with two terminals —
  `textual console` in one, `textual run --dev <app>.py` in the other — and emit via
  `self.log(...)`. Live CSS inspector (F1) in `--dev` mode.
- Docs index at `https://textual.textualize.io/`; fetch per-widget pages on demand for API
  detail.

### App & widget structure
- Subclass `App`; build the UI in `compose(self) -> ComposeResult`, `yield`-ing widgets. Run
  via `App().run()`. Custom widgets subclass `Widget`, with their own `compose()` and
  `DEFAULT_CSS`; pass data through `__init__` (call `super().__init__()`).
- Nest with container context managers (`Vertical`, `Horizontal`, `Grid`,
  `ScrollableContainer`). Find widgets with `self.query_one(selector, Type)` /
  `self.query(selector)` — never traverse the tree manually.

### Styling (TCSS)
- Style via `DEFAULT_CSS` (per widget), inline `CSS`, or external files through `CSS_PATH`.
- Prefer **semantic theme colors** (`$primary`, `$surface`, `$text`, `$error`, …) over
  hardcoded values; classes over IDs for reuse; variables for repeated values. Test both dark
  and light. Temporary `* { border: solid red; }` for layout debugging.

### State, events & workers
- Reactive attributes via `reactive(...)`; react in `watch_<name>(self, value)`. Use reactives
  only for genuinely dynamic UI-bound state.
- Message handlers follow `on_<message_name>` (`on_button_pressed(self, event: Button.Pressed)`).
  Custom messages subclass `Message` and `post_message(...)` (bubbles to ancestors). Key
  bindings: `BINDINGS = [("q", "quit", "Quit")]` → `action_quit(self)`.
- **Never block the event loop.** Offload I/O and CPU-heavy work (> ~100ms) to workers
  (`@work` or `self.run_worker(...)`); async workers for I/O, `thread=True` for CPU-bound.
  Update the UI from threads only via `self.call_from_thread(...)`. Store the `Worker` to
  cancel it; handle failures in `on_worker_state_changed`. Use `await asyncio.sleep()`, never
  `time.sleep()`.

### Screens & testing
- Screens subclass `Screen` (register in `SCREENS`); navigate with `push_screen` / `pop_screen`.
  Modals subclass `ModalScreen[ReturnType]`, return via `self.dismiss(value)`, await with
  `await self.push_screen_wait(Dialog())`.
- Test with pytest + the **Pilot** API: `async with app.run_test() as pilot:` then
  `await pilot.click(selector)` / `await pilot.press(keys)` and assert on app/widget state
  (async tests via `asyncio_mode = "auto"`).
