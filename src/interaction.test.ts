import { describe, expect, it } from "vitest";

import type { LocalContext } from "./context.js";
import { resolveInteractive } from "./interaction.js";

function fakeCtx(opts: {
  env?: Record<string, string>;
  stdinTTY?: boolean;
  stdoutTTY?: boolean;
}): LocalContext {
  return {
    process: {
      env: opts.env ?? {},
      stdin: { isTTY: opts.stdinTTY ?? true },
      stdout: { isTTY: opts.stdoutTTY ?? true },
    },
    rulesDir: "/rules",
  } as unknown as LocalContext;
}

describe("resolveInteractive", () => {
  it("is interactive on a clean TTY with the flag on", () => {
    expect(resolveInteractive(fakeCtx({}), true)).toBe(true);
  });

  it("is off when --no-interaction is given", () => {
    expect(resolveInteractive(fakeCtx({}), false)).toBe(false);
  });

  it("is off under CI", () => {
    expect(resolveInteractive(fakeCtx({ env: { CI: "1" } }), true)).toBe(false);
  });

  it("is off with the JARRIN_NO_INTERACTION escape hatch", () => {
    expect(
      resolveInteractive(
        fakeCtx({ env: { JARRIN_NO_INTERACTION: "1" } }),
        true,
      ),
    ).toBe(false);
  });

  it("is off when stdin or stdout is not a TTY", () => {
    expect(resolveInteractive(fakeCtx({ stdinTTY: false }), true)).toBe(false);
    expect(resolveInteractive(fakeCtx({ stdoutTTY: false }), true)).toBe(false);
  });
});
