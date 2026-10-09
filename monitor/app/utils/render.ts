import DOMPurify from "dompurify";
import { marked } from "marked";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Log kinds whose text is Markdown written by the model. */
export const MARKDOWN_KINDS: ReadonlySet<string> = new Set([
  "text",
  "thinking",
  "result",
]);

/** An object/array tool result, decoded; `undefined` for anything else. */
export function parseJson(text: string): JsonValue | undefined {
  const head = text.trimStart()[0];
  if (head !== "{" && head !== "[") return undefined;
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return undefined;
  }
}

/** A string worth rendering as a Markdown block rather than an inline value. */
export function isProse(value: string): boolean {
  return value.includes("\n") || value.length > 120;
}

/** Markdown to sanitised HTML: everything rendered here is untrusted model or tool output. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true }));
}
