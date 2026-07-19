import { generateHelpTextForAllCommands } from "@stricli/core";
import { describe, expect, it } from "vitest";

import { buildDocsApp } from "../routes.js";
import { renderFullHelp } from "./help.js";

/** Route names present in a rendered `help --full` document. */
function routesOf(hideInternal: boolean): string[] {
  return generateHelpTextForAllCommands(buildDocsApp(hideInternal)).map(
    ([route]) => route,
  );
}

describe("help --full", () => {
  it("documents every user-facing command", () => {
    const routes = routesOf(true);
    for (const expected of [
      "claudjar init",
      "claudjar info",
      "claudjar install",
      "claudjar worktree create",
      "claudjar worktree merge",
      "claudjar worktree remove",
      "claudjar worktree list",
      "claudjar goto",
      "claudjar start",
      "claudjar stop",
      "claudjar help",
    ]) {
      expect(routes).toContain(expected);
    }
  });

  it("omits the internal api commands by default", () => {
    expect(routesOf(true).filter((r) => r.includes("api"))).toEqual([]);
  });

  it("includes the internal api commands when asked", () => {
    const routes = routesOf(false);
    expect(routes).toContain("claudjar api session-start");
    expect(routes).toContain("claudjar api statusline");
  });

  it("keeps the two views identical apart from the api routes", () => {
    // Guards the buildRoutes factory: hiding internals must not change anything
    // else, or the generated skill reference would drift from the real CLI.
    const internal = routesOf(false).filter((r) => !r.includes("api"));
    expect(internal).toEqual(routesOf(true));
  });
});

describe("renderFullHelp", () => {
  it("renders each route as a fenced section", () => {
    const doc = renderFullHelp([
      ["claudjar thing", "USAGE\n  claudjar thing\n"],
    ]);
    expect(doc).toContain("### claudjar thing");
    expect(doc).toContain("```\nUSAGE\n  claudjar thing\n```");
  });

  it("marks the document as generated", () => {
    expect(renderFullHelp([])).toContain("claudjar help --full");
  });
});
