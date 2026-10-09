import { execFile, spawn } from "node:child_process";
import { Socket } from "node:net";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Escape for the notification body, which notification daemons read as markup. */
function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Desktop notification via `notify-send` (libnotify), with an "Open" action that
 * opens `url` through `xdg-open`, plus the same link in the body for daemons that
 * render markup (KDE, dunst). Fire-and-forget: the action wait never holds up the
 * loop or its exit, and a machine without `notify-send` just gets no popup.
 */
export function desktopNotify(title: string, body: string, url: string): void {
  const args = ["--app-name=claudjar", "--urgency=critical"];
  if (url) args.push("--action=open=Open question");
  const text =
    escapeMarkup(body) +
    (url ? `\n<a href="${escapeMarkup(url)}">Open question</a>` : "");
  args.push(title, text);
  try {
    const child = spawn("notify-send", args, {
      stdio: ["ignore", "pipe", "ignore"],
    });
    child.on("error", () => {});
    let chosen = "";
    child.stdout.on("data", (chunk: Buffer) => (chosen += chunk.toString()));
    child.on("close", () => {
      if (url && chosen.trim() === "open") {
        const open = spawn("xdg-open", [url], {
          stdio: "ignore",
          detached: true,
        });
        open.on("error", () => {});
        open.unref();
      }
    });
    child.unref();
    if (child.stdout instanceof Socket) child.stdout.unref();
  } catch {
    // No notification daemon is not a loop failure.
  }
}

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
