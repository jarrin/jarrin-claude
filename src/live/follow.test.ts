import { describe, expect, it } from "vitest";

import { follow, type FollowFs } from "./follow.js";

/** A scripted file: each poll runs the next step before looking. */
function scripted(steps: ((fs: Fake) => void)[]): Fake {
  const fs: Fake = {
    content: undefined,
    mtimeMs: undefined,
    writer: false,
    steps,
    size: () => Promise.resolve(fs.content?.length),
    mtime: () => Promise.resolve(fs.mtimeMs),
    read: (_: string, from: number, length: number) =>
      Promise.resolve(
        (fs.content ?? Buffer.alloc(0)).subarray(from, from + length),
      ),
    writing: () => {
      fs.steps.shift()?.(fs);
      return Promise.resolve(fs.writer);
    },
  };
  return fs;
}
interface Fake extends FollowFs {
  content: Buffer | undefined;
  mtimeMs: number | undefined;
  writer: boolean | undefined;
  steps: ((fs: Fake) => void)[];
}

async function run(fs: Fake, ok: () => boolean = () => true) {
  let t = 10_000;
  const sent: [string, boolean][] = [];
  await follow({
    file: "/f",
    fs,
    now: () => t,
    sleep: (ms) => {
      t += ms;
      return Promise.resolve();
    },
    send: (chunk, done) => {
      const good = ok();
      if (good) sent.push([chunk, done]);
      return Promise.resolve(good);
    },
  });
  return sent;
}

describe("follow", () => {
  it("streams what is appended and ends once the writer closes", async () => {
    const fs = scripted([
      (f) => ((f.writer = true), (f.content = Buffer.from("a\n"))),
      (f) => (f.content = Buffer.from("a\nb\n")),
      (f) => (f.writer = false),
    ]);
    expect(await run(fs)).toEqual([
      ["a\n", false],
      ["b\n", false],
      ["", true],
    ]);
  });

  it("skips what an old file held before the call", async () => {
    const fs = scripted([
      (f) => ((f.writer = true), (f.content = Buffer.from("old\nnew\n"))),
      (f) => (f.writer = false),
    ]);
    fs.content = Buffer.from("old\n");
    fs.mtimeMs = 0;
    expect(await run(fs)).toEqual([
      ["new\n", false],
      ["", true],
    ]);
  });

  it("ends after a grace period when no writer was ever seen", async () => {
    const fs = scripted([(f) => (f.content = Buffer.from("all\n"))]);
    fs.writer = false;
    const sent = await run(fs);
    expect(sent[0]).toEqual(["all\n", false]);
    expect(sent.at(-1)).toEqual(["", true]);
  });

  it("keeps a chunk the monitor missed for the next send", async () => {
    const fs = scripted([
      (f) => ((f.writer = true), (f.content = Buffer.from("a\n"))),
      (f) => (f.content = Buffer.from("a\nb\n")),
      (f) => (f.writer = false),
    ]);
    let calls = 0;
    expect(await run(fs, () => ++calls > 1)).toEqual([
      ["a\nb\n", false],
      ["", true],
    ]);
  });

  it("without /proc, ends once the file stops growing", async () => {
    const fs = scripted([(f) => (f.content = Buffer.from("x"))]);
    fs.writer = undefined;
    const sent = await run(fs);
    expect(sent).toEqual([
      ["x", false],
      ["", true],
    ]);
  });
});
