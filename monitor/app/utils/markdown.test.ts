import { describe, expect, it } from "vitest";
import { fence } from "./markdown";

describe("fence", () => {
  it("outgrows any backtick run inside the code", () => {
    expect(fence("bash", "echo hi")).toBe("```bash\necho hi\n```");
    expect(fence("md", "a ```` b", "[x.md]")).toBe(
      "`````md [x.md]\na ```` b\n`````",
    );
  });
});
