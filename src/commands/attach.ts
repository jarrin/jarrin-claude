import { spawnSync } from "node:child_process";

import { buildCommand } from "@stricli/core";

import type { LocalContext } from "../context.js";
import {
  attachEntries,
  renderAttachList,
  resolveAttach,
} from "../service/attach.js";
import { readState, serviceDir, statePath } from "../service/state.js";
import { launcherCache } from "../session/launcher.js";

/**
 * `claudjar attach [--list] [<name>]` — bring a background session the service
 * started to the front of this terminal. Names are `<project>` or
 * `<project>/<worktree>` (`src/session/names.ts`); the sessions come from the
 * service's state file, their liveness from the launcher.
 */
function runAttach(
  this: LocalContext,
  flags: { readonly list: boolean },
  name?: string,
): void {
  const proc = this.process;
  const fail = (msg: string): void => {
    proc.stderr.write(`attach: ${msg}\n`);
    proc.exitCode = 1;
  };

  const file = statePath(serviceDir(proc.env));
  let records;
  try {
    records = readState(file).sessions;
  } catch (err) {
    return fail(
      `cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const launcherFor = launcherCache();
  const entries = attachEntries(records, launcherFor);

  if (flags.list || name === undefined) {
    proc.stdout.write(renderAttachList(entries));
    return;
  }

  const target = resolveAttach(entries, name);
  if (!target.ok) return fail(target.error);
  const { record } = target.entry;
  let argv: string[];
  try {
    argv = launcherFor(record.backend).attachCommand(record.name);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  const [cmd, ...args] = argv;
  if (!cmd) return fail("the launcher gave no attach command.");
  // Node has no exec(): run it on this terminal and pass its exit code on.
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) return fail(`could not run ${cmd}: ${res.error.message}`);
  if (res.status !== null && res.status !== 0) proc.exitCode = res.status;
}

export const attachCommand = buildCommand({
  func: runAttach,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Session name: <project> or <project>/<worktree>",
          parse: String,
          placeholder: "name",
          optional: true,
        },
      ],
    },
    flags: {
      list: {
        kind: "boolean",
        brief: "List the service's sessions with their status",
        default: false,
      },
    },
  },
  docs: {
    brief: "Bring a background session started by the service to this terminal",
    fullDescription:
      "Reads the sessions the claudjar service recorded " +
      "(~/.claudjar/service/state.json; JARRIN_SERVICE_DIR overrides) and runs " +
      "the launcher's attach command for the named one — `claude attach <id>` " +
      "for a background session, `tmux attach-session` for the tmux fallback. " +
      "Names are `<project>` for a project's session and " +
      "`<project>/<worktree>` for a worktree's; the launcher's own name " +
      "(`<project>--<worktree>`) is accepted too. Without a name, or with " +
      "--list, it lists the sessions and whether each is running. An unknown or " +
      "stopped name fails and lists the running ones.",
  },
});
