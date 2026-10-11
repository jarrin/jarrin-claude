import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fakeLauncher } from "./fake-launcher.js";
import {
  claudeConfigPath,
  isTrusted,
  requireTrust,
  trustWorkspace,
} from "./trust.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "trust-"));
  file = join(dir, ".claude.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(config: unknown): void {
  writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
}

function readConfig(): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("claudeConfigPath", () => {
  it("honours CLAUDE_CONFIG_DIR", () => {
    expect(claudeConfigPath({ CLAUDE_CONFIG_DIR: "/cfg" })).toBe(
      "/cfg/.claude.json",
    );
  });

  it("defaults to ~/.claude.json", () => {
    expect(claudeConfigPath({})).toMatch(/\/\.claude\.json$/);
  });
});

describe("isTrusted", () => {
  it("trusts a flagged path and everything under it", () => {
    writeConfig({
      projects: { "/p/web": { hasTrustDialogAccepted: true } },
    });
    expect(isTrusted(file, "/p/web")).toBe(true);
    expect(isTrusted(file, "/p/web/sub/dir")).toBe(true);
  });

  it("does not trust a sibling, a parent, or an unflagged entry", () => {
    writeConfig({
      projects: {
        "/p/web": { hasTrustDialogAccepted: true },
        "/p/api": { hasTrustDialogAccepted: false },
      },
    });
    expect(isTrusted(file, "/p/web-worktrees/dev")).toBe(false);
    expect(isTrusted(file, "/p")).toBe(false);
    expect(isTrusted(file, "/p/api")).toBe(false);
  });

  it("is false for a missing or unparseable config", () => {
    expect(isTrusted(file, "/p/web")).toBe(false);
    writeFileSync(file, "{ not json");
    expect(isTrusted(file, "/p/web")).toBe(false);
  });
});

describe("trustWorkspace", () => {
  it("flags the path and keeps every other key", async () => {
    writeConfig({
      numStartups: 3,
      projects: {
        "/p/web": { hasTrustDialogAccepted: true, allowedTools: [] },
        "/p/web-worktrees/dev": { lastCost: 1 },
      },
    });
    expect(await trustWorkspace(file, "/p/web-worktrees/dev/")).toBe(true);
    expect(readConfig()).toEqual({
      numStartups: 3,
      projects: {
        "/p/web": { hasTrustDialogAccepted: true, allowedTools: [] },
        "/p/web-worktrees/dev": { lastCost: 1, hasTrustDialogAccepted: true },
      },
    });
    expect(isTrusted(file, "/p/web-worktrees/dev")).toBe(true);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });

  it("adds a projects map when there is none", async () => {
    writeConfig({});
    expect(await trustWorkspace(file, "/p/x")).toBe(true);
    expect(readConfig()).toEqual({
      projects: { "/p/x": { hasTrustDialogAccepted: true } },
    });
  });

  it("leaves an already trusted path, and a missing config, alone", async () => {
    expect(await trustWorkspace(file, "/p/x")).toBe(false);
    expect(existsSync(file)).toBe(false);
    writeConfig({ projects: { "/p/x": { hasTrustDialogAccepted: true } } });
    expect(await trustWorkspace(file, "/p/x")).toBe(false);
  });

  it("serialises concurrent writers through the lock", async () => {
    writeConfig({ projects: {} });
    await Promise.all(
      ["/p/a", "/p/b", "/p/c"].map((p) => trustWorkspace(file, p)),
    );
    for (const p of ["/p/a", "/p/b", "/p/c"])
      expect(isTrusted(file, p)).toBe(true);
  });
});

describe("requireTrust", () => {
  it("refuses an untrusted cwd before the launcher is asked", () => {
    const inner = fakeLauncher();
    const launcher = requireTrust(inner, (cwd) => cwd === "/p/web");
    expect(() => launcher.start("s", "/p/api")).toThrow(
      /workspace \/p\/api is not trusted by Claude Code — run `claude` there once/,
    );
    expect(inner.calls).toEqual([]);
    launcher.start("s", "/p/web");
    expect(inner.calls).toEqual(["start s /p/web"]);
    expect(launcher.list().map((s) => s.name)).toEqual(["s"]);
    launcher.stop("s");
    expect(launcher.status("s")).toBe("absent");
  });
});
