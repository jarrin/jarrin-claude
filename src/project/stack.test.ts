import { describe, expect, it } from "vitest";

import { emptyConfig } from "../config/schema.js";
import type { JarrinConfig } from "../config/schema.js";
import {
  effectivePort,
  isExitReason,
  isStartSource,
  PORT_ENV,
  resolveStack,
  runStackCommand,
  showsPort,
  stackStatusText,
} from "./stack.js";

function cfgWith(overrides: {
  projectPort?: number;
  start?: string;
  exit?: string;
  wtName?: string;
  wtPort?: number;
}): JarrinConfig {
  const cfg = emptyConfig();
  cfg.project.port = overrides.projectPort ?? 0;
  cfg.project.commands.start = overrides.start ?? "";
  cfg.project.commands.exit = overrides.exit ?? "";
  cfg.worktree.name = overrides.wtName ?? "";
  cfg.worktree.port = overrides.wtPort ?? 0;
  return cfg;
}

describe("effectivePort", () => {
  it("prefers the worktree's assigned port over the project base", () => {
    expect(effectivePort(cfgWith({ projectPort: 8000, wtPort: 8003 }))).toBe(
      8003,
    );
  });

  it("falls back to the project base when the worktree has none", () => {
    expect(effectivePort(cfgWith({ projectPort: 8000 }))).toBe(8000);
  });
});

describe("resolveStack", () => {
  it("is active only inside a named worktree with a port", () => {
    const stack = resolveStack(
      cfgWith({
        projectPort: 8000,
        wtName: "feature-x",
        wtPort: 8001,
        start: "up",
        exit: "down",
      }),
    );
    expect(stack).toEqual({
      active: true,
      port: 8001,
      name: "feature-x",
      start: "up",
      exit: "down",
    });
  });

  it("is inactive in the main checkout (no stamped name)", () => {
    // Even with a project.port set, the main checkout has no worktree.name.
    expect(resolveStack(cfgWith({ projectPort: 8000 })).active).toBe(false);
  });

  it("is inactive when there is no usable port", () => {
    expect(resolveStack(cfgWith({ wtName: "feature-x" })).active).toBe(false);
  });
});

describe("source / reason predicates", () => {
  it("runs start ONLY on a new shell", () => {
    expect(isStartSource("startup")).toBe(true);
    for (const s of ["clear", "resume", "compact", ""]) {
      expect(isStartSource(s)).toBe(false);
    }
  });

  it("shows the port on startup and clear only", () => {
    expect(showsPort("startup")).toBe(true);
    expect(showsPort("clear")).toBe(true);
    expect(showsPort("resume")).toBe(false);
    expect(showsPort("compact")).toBe(false);
  });

  it("runs exit on every reason except clear", () => {
    expect(isExitReason("clear")).toBe(false);
    for (const r of ["logout", "prompt_input_exit", "other", ""]) {
      expect(isExitReason(r)).toBe(true);
    }
  });
});

describe("runStackCommand", () => {
  function fakeProc(): NodeJS.Process {
    const errors: string[] = [];
    const proc = {
      env: { PATH: process.env.PATH ?? "" },
      stderr: { write: (m: string) => void errors.push(m) },
      _errors: errors,
    };
    return proc as unknown as NodeJS.Process;
  }

  it("exposes the port as PROJECT_PORT and relays stdout to stderr", () => {
    const proc = fakeProc();
    const status = runStackCommand(
      `echo "port is $${PORT_ENV}"`,
      8042,
      process.cwd(),
      proc,
    );
    expect(status).toBe(0);
    const errors = (proc as unknown as { _errors: string[] })._errors.join("");
    expect(errors).toContain("port is 8042");
  });

  it("returns the command's non-zero exit code", () => {
    const proc = fakeProc();
    expect(runStackCommand("exit 3", 8000, process.cwd(), proc)).toBe(3);
  });
});

describe("stackStatusText", () => {
  it("names the worktree and the PROJECT_PORT", () => {
    const text = stackStatusText("feature-x", 8001);
    expect(text).toContain("feature-x");
    expect(text).toContain("PROJECT_PORT=**8001**");
  });
});

// Guard against an accidental rename of the env var the commands rely on.
it("pins the port env var name", () => {
  expect(PORT_ENV).toBe("PROJECT_PORT");
});
