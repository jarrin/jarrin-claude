export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
