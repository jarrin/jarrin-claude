import security from "@comark/nuxt/plugins/security";
import shiki from "@comark/nuxt/plugins/shiki";
import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import docker from "@shikijs/langs/docker";
import go from "@shikijs/langs/go";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdown from "@shikijs/langs/markdown";
import php from "@shikijs/langs/php";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import sql from "@shikijs/langs/sql";
import toml from "@shikijs/langs/toml";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import vue from "@shikijs/langs/vue";
import yaml from "@shikijs/langs/yaml";
import materialLighter from "@shikijs/themes/material-theme-lighter";
import materialPalenight from "@shikijs/themes/material-theme-palenight";

/**
 * Comark plugins for every `<Markdown>` in the log. The text is untrusted model
 * and tool output (issue comments, fetched pages), and Comark keeps raw HTML by
 * default, so anything that can run script or load a page is dropped.
 */
export const markdownPlugins = [
  // Everything is registered statically, defaults included: Comark otherwise
  // lazy-loads its default themes/grammars, and when one of those chunk loads
  // fails every block in the log renders empty. The list also adds what Comark's
  // web-only defaults lack: diffs and the languages the loop's repos use.
  shiki({
    registerDefaultThemes: false,
    registerDefaultLanguages: false,
    themes: { light: materialLighter, dark: materialPalenight },
    languages: [
      bash,
      css,
      diff,
      docker,
      go,
      html,
      javascript,
      json,
      markdown,
      php,
      python,
      rust,
      sql,
      toml,
      tsx,
      typescript,
      vue,
      yaml,
    ],
  }),
  security({
    blockedTags: [
      "script",
      "style",
      "iframe",
      "frame",
      "embed",
      "object",
      "form",
      "input",
      "button",
      "textarea",
      "link",
      "meta",
      "base",
    ],
  }),
];

/** A fenced code block whose fence cannot be closed early by the code itself. */
export function fence(lang: string, code: string, meta = ""): string {
  const longest = Math.max(
    0,
    ...(code.match(/`+/g) ?? []).map((run) => run.length),
  );
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}${lang}${meta ? ` ${meta}` : ""}\n${code}\n${ticks}`;
}
