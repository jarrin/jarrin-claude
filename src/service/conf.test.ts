import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ConfError,
  confPath,
  DEFAULT_CONF_PATH,
  parseConf,
  readConf,
} from "./conf.js";

function problems(text: string): readonly string[] {
  try {
    parseConf(text);
  } catch (err) {
    if (err instanceof ConfError) return err.problems;
    throw err;
  }
  throw new Error("expected a ConfError");
}

describe("parseConf", () => {
  it("parses a full conf", () => {
    expect(
      parseConf(
        "projects_dir: /home/jarrin/Projects\nuser: jarrin\n" +
          "monitor:\n  url: wss://claudjar.jarrin.nl\n  token: s3cret\n",
      ),
    ).toEqual({
      projectsDir: "/home/jarrin/Projects",
      user: "jarrin",
      monitor: { url: "wss://claudjar.jarrin.nl", token: "s3cret" },
    });
  });

  it("makes monitor optional, but requires its token", () => {
    expect(parseConf("projects_dir: /p\nuser: u\n").monitor).toBeNull();
    expect(
      problems("projects_dir: /p\nuser: u\nmonitor:\n  url: https://m\n"),
    ).toEqual([
      "`monitor.token` is required when `monitor` is set (the monitor's NUXT_AGENT_TOKEN)",
    ]);
  });

  it("rejects invalid YAML and non-mappings", () => {
    expect(problems("projects_dir: [")[0]).toMatch(/not valid YAML/);
    expect(problems("- a\n- b\n")[0]).toMatch(/expected a mapping/);
    expect(problems("")[0]).toMatch(/expected a mapping/);
  });

  it("requires projects_dir and user", () => {
    expect(problems("{}")).toEqual([
      "`projects_dir` is required (an absolute path)",
      "`user` is required (the account the service runs as)",
    ]);
  });

  it("reports every problem at once", () => {
    expect(
      problems(
        "projects_dir: Projects\nuser: Bad User\nproject_dir: /x\n" +
          "monitor:\n  url: ftp://m\n  tokn: x\n",
      ),
    ).toEqual([
      "unknown key `project_dir`",
      "`projects_dir` must be absolute, got `Projects`",
      "`user` is not a valid user name: `Bad User`",
      "unknown key `monitor.tokn`",
      "`monitor.url` must be a ws(s):// or http(s):// URL, got `ftp://m`",
      "`monitor.token` is required when `monitor` is set (the monitor's NUXT_AGENT_TOKEN)",
    ]);
  });

  it("refuses root and a non-string token", () => {
    expect(problems("projects_dir: /p\nuser: root\n")).toEqual([
      "`user` must not be root — the service runs at user level",
    ]);
    expect(
      problems(
        "projects_dir: /p\nuser: u\nmonitor:\n  url: wss://m\n  token: 42\n",
      ),
    ).toEqual(["`monitor.token` must be a string"]);
    expect(problems("projects_dir: /p\nuser: u\nmonitor: wss://m\n")).toEqual([
      "`monitor` must be a mapping with `url` and `token`",
    ]);
  });
});

describe("confPath / readConf", () => {
  it("honours CLAUDJAR_CONF", () => {
    expect(confPath({})).toBe(DEFAULT_CONF_PATH);
    expect(confPath({ CLAUDJAR_CONF: "/tmp/x.conf" })).toBe("/tmp/x.conf");
  });

  it("fails loudly on a missing file, with an example", () => {
    const missing = join(mkdtempSync(join(tmpdir(), "cj-conf-")), "nope.conf");
    expect(() => readConf(missing)).toThrow(
      /file not found[\s\S]*projects_dir:/,
    );
  });

  it("names the file in the error", () => {
    const file = join(mkdtempSync(join(tmpdir(), "cj-conf-")), "c.conf");
    writeFileSync(file, "user: u\n");
    expect(() => readConf(file)).toThrow(
      `${file}: invalid claudjar service config`,
    );
  });
});
