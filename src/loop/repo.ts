import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** `git stash push -u -m <label>` when `cwd` has uncommitted work; true when it stashed. */
export async function stashIfDirty(
  cwd: string,
  label: string,
): Promise<boolean> {
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd });
  if (!stdout.trim()) return false;
  await run("git", ["stash", "push", "--include-untracked", "-m", label], {
    cwd,
  });
  return true;
}

/** `git push` of the checked-out branch to its upstream; the error text when it fails. */
export async function pushBranch(cwd: string): Promise<string | null> {
  try {
    await run("git", ["push"], { cwd });
    return null;
  } catch (err) {
    const stderr =
      err instanceof Error && "stderr" in err ? String(err.stderr).trim() : "";
    return stderr || (err instanceof Error ? err.message : String(err));
  }
}
