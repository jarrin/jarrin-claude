import { describe, expect, it } from "vitest";
import { isProse, parseJson } from "./json";

describe("parseJson", () => {
  it("decodes objects and arrays", () => {
    expect(parseJson(' [{"body":"**hi**"}]')).toEqual([{ body: "**hi**" }]);
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("leaves scalars, plain text and broken JSON alone", () => {
    expect(parseJson("42")).toBeUndefined();
    expect(parseJson("hello")).toBeUndefined();
    expect(parseJson('[{"body":"cut')).toBeUndefined();
  });
});

describe("isProse", () => {
  it("treats multi-line or long strings as prose", () => {
    expect(isProse("a\nb")).toBe(true);
    expect(isProse("x".repeat(121))).toBe(true);
    expect(isProse("2026-10-09T12:00:00Z")).toBe(false);
  });
});
