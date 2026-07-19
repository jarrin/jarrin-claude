import { describe, expect, it } from "vitest";

import { ENV_VERSION_KEY, syncVersion } from "./sync.js";

describe("syncVersion — json", () => {
  it("rewrites the top-level version, preserving formatting", () => {
    const text = `{
  "name": "demo",
  "version": "0.1.0",
  "scripts": {
    "build": "tsup"
  }
}
`;
    const r = syncVersion("package.json", text, "0.1.1");
    expect(r.status).toBe("updated");
    expect(r.text).toBe(text.replace('"0.1.0"', '"0.1.1"'));
  });

  it("does not touch a nested version (a pinned dependency)", () => {
    const text = `{
  "name": "demo",
  "version": "1.0.0",
  "dependencies": {
    "version": "2.3.4",
    "left-pad": "1.0.0"
  }
}
`;
    const r = syncVersion("package.json", text, "1.1.0");
    expect(r.status).toBe("updated");
    expect(r.text).toContain('"version": "1.1.0"');
    // The dependency literally named "version" keeps its pin.
    expect(r.text).toContain('"version": "2.3.4"');
  });

  it("is not fooled by a 'version' appearing inside a string value", () => {
    const text = `{
  "description": "the \\"version\\" bumper",
  "version": "1.0.0"
}
`;
    const r = syncVersion("composer.json", text, "1.0.1");
    expect(r.status).toBe("updated");
    expect(r.text).toContain('"version": "1.0.1"');
    expect(r.text).toContain('the \\"version\\" bumper');
  });

  it("reports unchanged when the version already matches", () => {
    const text = `{ "version": "2.0.0" }`;
    const r = syncVersion("package.json", text, "2.0.0");
    expect(r.status).toBe("unchanged");
    expect(r.text).toBe(text);
  });

  it("reports no-field when the manifest has no top-level version", () => {
    const text = `{ "name": "demo", "private": true }`;
    expect(syncVersion("package.json", text, "1.0.0").status).toBe("no-field");
  });
});

describe("syncVersion — env", () => {
  it("updates an existing APP_VERSION in place", () => {
    const text = `DB_HOST=localhost\n${ENV_VERSION_KEY}=0.1.0\nDEBUG=1\n`;
    const r = syncVersion(".env", text, "0.2.0");
    expect(r.status).toBe("updated");
    expect(r.text).toBe(
      `DB_HOST=localhost\n${ENV_VERSION_KEY}=0.2.0\nDEBUG=1\n`,
    );
  });

  it("keeps an export prefix", () => {
    const r = syncVersion(".env", `export ${ENV_VERSION_KEY}=0.1.0\n`, "0.1.1");
    expect(r.text).toBe(`export ${ENV_VERSION_KEY}=0.1.1\n`);
  });

  it("appends the key when absent, with one trailing newline", () => {
    const r = syncVersion(".env", "DB_HOST=localhost\n", "1.0.0");
    expect(r.status).toBe("updated");
    expect(r.text).toBe(`DB_HOST=localhost\n${ENV_VERSION_KEY}=1.0.0\n`);
  });

  it("handles an empty file", () => {
    const r = syncVersion(".env", "", "1.0.0");
    expect(r.text).toBe(`${ENV_VERSION_KEY}=1.0.0\n`);
  });

  it("matches .env.production too", () => {
    expect(syncVersion(".env.production", "", "1.0.0").kind).toBe("env");
  });
});

describe("syncVersion — toml", () => {
  it("rewrites version in [project]", () => {
    const text = `[project]\nname = "demo"\nversion = "0.1.0"\n`;
    const r = syncVersion("src/worker/pyproject.toml", text, "0.1.1");
    expect(r.status).toBe("updated");
    expect(r.text).toBe(
      `[project]\nname = "demo"\nversion = "0.1.0"\n`.replace("0.1.0", "0.1.1"),
    );
  });

  it("rewrites version in [tool.poetry]", () => {
    const text = `[tool.poetry]\nversion = "1.0.0"\n`;
    const r = syncVersion("pyproject.toml", text, "1.1.0");
    expect(r.text).toContain('version = "1.1.0"');
  });

  it("leaves a dependency pin in another table alone", () => {
    const text = [
      "[project]",
      'name = "demo"',
      'version = "0.1.0"',
      "",
      "[tool.poetry.dependencies]",
      'version = "9.9.9"',
      "",
    ].join("\n");
    const r = syncVersion("pyproject.toml", text, "0.2.0");
    expect(r.text).toContain('version = "0.2.0"');
    expect(r.text).toContain('version = "9.9.9"');
  });

  it("reports no-field when no owning table carries a version", () => {
    const text = `[tool.ruff]\nline-length = 88\n`;
    expect(syncVersion("pyproject.toml", text, "1.0.0").status).toBe(
      "no-field",
    );
  });
});

describe("syncVersion — yaml", () => {
  it("updates a top-level version, keeping comments", () => {
    const text = `# app chart\nname: demo\nversion: 0.1.0\n`;
    const r = syncVersion("Chart.yaml", text, "0.2.0");
    expect(r.status).toBe("updated");
    expect(r.text).toContain("# app chart");
    expect(r.text).toContain("version: 0.2.0");
  });

  it("reports no-field rather than inventing a key", () => {
    expect(syncVersion("Chart.yaml", "name: demo\n", "1.0.0").status).toBe(
      "no-field",
    );
  });
});

describe("syncVersion — dispatch", () => {
  it("reports unsupported for a filename no handler claims", () => {
    const r = syncVersion("README.md", "# hi\n", "1.0.0");
    expect(r.status).toBe("unsupported");
    expect(r.text).toBe("# hi\n");
  });
});
