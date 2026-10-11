import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname, tmpdir, userInfo } from "node:os";
import { join } from "node:path";

import { buildCommand, buildRouteMap } from "@stricli/core";

import type { LocalContext } from "../context.js";
import type { ServiceConf } from "../service/conf.js";
import { ConfError, confPath, readConf } from "../service/conf.js";
import { statusPorcelain, worktreeListPorcelain } from "../git.js";
import { giteaClient, resolveAuth } from "../loop/gitea.js";
import { readIdentity } from "../service/detail.js";
import { scanProjectsDir } from "../service/discover.js";
import { connectHost } from "../service/link.js";
import { runService } from "../service/run.js";
import { readState, serviceDir, statePath } from "../service/state.js";
import type { SessionBackend, SessionLauncher } from "../session/launcher.js";
import { isTrusted, requireTrust } from "../session/trust.js";
import {
  launcherCache,
  scopeAvailable,
  spawnRunner as procRunner,
} from "../session/launcher.js";
import {
  isAlive,
  lockHolder,
  loopLocks,
  loopStateDir,
  milestoneLockPath,
} from "./loop.js";
import {
  selfCommand,
  spawnLoop,
  stopLoopProcess,
} from "../service/spawn-loop.js";
import type { WorktreeDeps } from "../worktree/lib.js";
import {
  createWorktree,
  mergeWorktree,
  removeWorktree,
} from "../worktree/lib.js";
import { spawnRunner } from "../worktree/runner.js";
import type { Passwd } from "../service/unit.js";
import {
  parsePasswd,
  renderUnit,
  UNIT_NAME,
  UNIT_PATH,
} from "../service/unit.js";

/**
 * `claudjar service` — the long-lived per-user service configured in
 * `/etc/claudjar.conf`: it discovers the projects under `projects_dir` and (in
 * later stages) opens them, runs their background sessions, and links them to
 * the web interface.
 */

/** Load the conf, or report why not and set a failing exit code. */
function loadConf(ctx: LocalContext, verb: string): ServiceConf | null {
  try {
    return readConf(confPath(ctx.process.env));
  } catch (err) {
    ctx.process.stderr.write(
      `service ${verb}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (!(err instanceof ConfError)) throw err;
    ctx.process.exitCode = 1;
    return null;
  }
}

function lookupUser(user: string): Passwd | null {
  const res = spawnSync("getent", ["passwd", user], { encoding: "utf8" });
  return res.status === 0 ? parsePasswd(res.stdout) : null;
}

interface RunFlags {
  readonly once: boolean;
  readonly interval: number;
}

async function runServiceRun(
  this: LocalContext,
  flags: RunFlags,
): Promise<void> {
  const proc = this.process;
  const conf = loadConf(this, "run");
  if (!conf) return;

  const me = userInfo().username;
  if (me !== conf.user) {
    proc.stderr.write(
      `service run: running as '${me}', but ${confPath(proc.env)} names ` +
        `user '${conf.user}' — run it as that user (the unit does).\n`,
    );
    proc.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  const log = (line: string): void => void proc.stdout.write(`${line}\n`);
  const { monitor } = conf;
  // The same credentials `claudjar loop` uses, so the project tab and a loop
  // started from it read the forge as the same user.
  const auth = resolveAuth(proc.env);
  const home = homedir();
  const loopLogDir = join(serviceDir(proc.env), "loops");
  let scope: boolean | undefined;
  const wtDeps: WorktreeDeps = {
    run: spawnRunner(proc.env),
    log: (msg) => void proc.stdout.write(msg),
    warn: (msg) => void proc.stderr.write(msg),
    caddyDir: this.caddyDir,
    claudeConfig: this.claudeConfig,
  };
  // Every session the service starts refuses an untrusted workspace with a
  // clear "run `claude` there once"; a worktree it creates inherits trust.
  const launchers = launcherCache();
  const trustedLaunchers = (backend: SessionBackend): SessionLauncher =>
    requireTrust(launchers(backend), (cwd) =>
      isTrusted(this.claudeConfig, cwd),
    );
  proc.once("SIGTERM", stop);
  proc.once("SIGINT", stop);
  try {
    await runService({
      conf,
      stateFile: statePath(serviceDir(proc.env)),
      intervalMs: flags.interval * 1000,
      once: flags.once,
      signal: controller.signal,
      log,
      scan: scanProjectsDir,
      backend: "bg",
      launcherFor: trustedLaunchers,
      detail: {
        worktreeList: worktreeListPorcelain,
        identity: readIdentity,
        forge: auth ? (repo) => giteaClient(auth, repo) : null,
        forgeUrl: auth?.host ?? "",
        now: Date.now,
        isAlive,
      },
      worktrees: {
        create: (repoRoot, opts) => createWorktree(repoRoot, opts, wtDeps),
        merge: (repoRoot, opts) => mergeWorktree(repoRoot, opts, wtDeps),
        remove: (repoRoot, opts) => removeWorktree(repoRoot, opts, wtDeps),
        dirty: statusPorcelain,
        worktreeLoopHolder: (repo, path) => {
          const [lock] = loopLocks(loopStateDir(home, repo), path, []);
          return lock ? lockHolder(lock.path) : null;
        },
        stopLoop: (pid) => stopLoopProcess(pid, isAlive),
        loopHolder: (repo, id) =>
          lockHolder(milestoneLockPath(loopStateDir(home, repo), id)),
        startLoop: (spec) => {
          // A loop keeps its progress on the monitor: without one it cannot run.
          if (!monitor)
            return Promise.reject(
              new Error(
                "no `monitor:` in the service conf for the loop to report to",
              ),
            );
          scope ??= scopeAvailable(procRunner);
          return spawnLoop(
            {
              bin: selfCommand(proc),
              scope,
              logDir: loopLogDir,
              monitorUrl: monitor.url,
              monitorToken: monitor.token,
              env: proc.env,
            },
            spec,
          );
        },
      },
      ...(monitor
        ? {
            connect: (handlers) =>
              connectHost({
                url: monitor.url,
                token: monitor.token,
                host: {
                  host: hostname(),
                  pid: proc.pid,
                  startedAt: Date.now(),
                },
                log,
                ...handlers,
              }),
          }
        : {}),
    });
  } finally {
    proc.off("SIGTERM", stop);
    proc.off("SIGINT", stop);
  }
}

/** Run a command, prefixed with sudo unless already root, echoing it first. */
function privileged(
  ctx: LocalContext,
  args: readonly string[],
  dryRun: boolean,
): boolean {
  const root = ctx.process.geteuid?.() === 0;
  const argv = root ? [...args] : ["sudo", ...args];
  ctx.process.stdout.write(`$ ${argv.join(" ")}\n`);
  if (dryRun) return true;
  const [cmd, ...rest] = argv;
  if (!cmd) return false;
  const res = spawnSync(cmd, rest, { stdio: "inherit" });
  if (res.status === 0) return true;
  ctx.process.stderr.write(
    `service: \`${argv.join(" ")}\` failed (exit ${String(res.status ?? 1)}).\n`,
  );
  ctx.process.exitCode = 1;
  return false;
}

interface InstallFlags {
  readonly bin?: string;
  readonly dryRun: boolean;
}

function runServiceInstall(this: LocalContext, flags: InstallFlags): void {
  const proc = this.process;
  const fail = (msg: string): void => {
    proc.stderr.write(`service install: ${msg}\n`);
    proc.exitCode = 1;
  };
  const conf = loadConf(this, "install");
  if (!conf) return;

  const pw = lookupUser(conf.user);
  if (!pw) return fail(`no such user '${conf.user}' (getent passwd).`);
  const bin = flags.bin ?? join(pw.home, ".local", "bin", "claudjar");
  if (!existsSync(bin)) {
    return fail(
      `${bin} does not exist — run \`claudjar install\` as ${conf.user}, or pass --bin.`,
    );
  }

  const unit = renderUnit({
    user: pw.user,
    uid: pw.uid,
    home: pw.home,
    bin,
    confPath: confPath(proc.env),
  });
  proc.stdout.write(`${UNIT_PATH}:\n\n${unit}\n`);

  const dir = mkdtempSync(join(tmpdir(), "claudjar-unit-"));
  const tmp = join(dir, UNIT_NAME);
  writeFileSync(tmp, unit);
  try {
    const steps: (readonly string[])[] = [
      ["install", "-m", "0644", tmp, UNIT_PATH],
      ["systemctl", "daemon-reload"],
      ["systemctl", "enable", UNIT_NAME],
      // restart, not start: a reinstall must pick up the rewritten unit.
      ["systemctl", "restart", UNIT_NAME],
    ];
    for (const step of steps) {
      if (!privileged(this, step, flags.dryRun)) return;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (!flags.dryRun) {
    proc.stdout.write(
      `\nInstalled. Follow it with: journalctl -u ${UNIT_NAME} -f\n`,
    );
  }
}

function runServiceUninstall(
  this: LocalContext,
  flags: { readonly dryRun: boolean },
): void {
  const steps: (readonly string[])[] = [
    ["systemctl", "disable", "--now", UNIT_NAME],
    ["rm", "-f", UNIT_PATH],
    ["systemctl", "daemon-reload"],
  ];
  for (const step of steps) {
    if (!privileged(this, step, flags.dryRun)) return;
  }
}

function query(cmd: string, args: readonly string[]): string {
  const res = spawnSync(cmd, [...args], { encoding: "utf8" });
  return (res.stdout ?? "").trim() || "unknown";
}

function runServiceStatus(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(`${msg}\n`);
  const path = confPath(proc.env);
  out(`conf:     ${path}`);
  const conf = loadConf(this, "status");

  out(`unit:     ${existsSync(UNIT_PATH) ? UNIT_PATH : "not installed"}`);
  out(`active:   ${query("systemctl", ["is-active", UNIT_NAME])}`);
  out(`enabled:  ${query("systemctl", ["is-enabled", UNIT_NAME])}`);
  if (!conf) return;

  out(`user:     ${conf.user}`);
  out(`projects: ${conf.projectsDir}`);
  out(`monitor:  ${conf.monitor ? conf.monitor.url : "not configured"}`);
  const linger = query("loginctl", [
    "show-user",
    conf.user,
    "-p",
    "Linger",
    "--value",
  ]);
  out(
    `linger:   ${linger}` +
      (linger === "yes"
        ? ""
        : ` — background sessions need ${conf.user}'s systemd manager, which ` +
          `without linger runs only while ${conf.user} is logged in ` +
          `(sudo loginctl enable-linger ${conf.user})`),
  );

  const pw = lookupUser(conf.user);
  if (!pw) return;
  const file = statePath(
    proc.env.JARRIN_SERVICE_DIR ?? join(pw.home, ".claudjar", "service"),
  );
  if (!existsSync(file)) {
    out(`state:    ${file} (not written yet)`);
    return;
  }
  try {
    const state = readState(file);
    const active = state.projects.filter((p) => p.active).length;
    out(
      `state:    ${file} — ${String(state.projects.length)} project(s), ` +
        `${String(active)} active, ${String(state.sessions.length)} session(s), ` +
        `updated ${state.updatedAt || "never"}`,
    );
  } catch (err) {
    out(
      `state:    ${file} — unreadable (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

const dryRunFlag = {
  kind: "boolean",
  brief: "Print what would run without running it",
  default: false,
} as const;

const runCommand = buildCommand({
  func: runServiceRun,
  parameters: {
    flags: {
      once: {
        kind: "boolean",
        brief: "Scan once, log the projects, and exit",
        default: false,
      },
      interval: {
        kind: "parsed",
        parse: (s: string): number => {
          const n = Number(s);
          if (!Number.isInteger(n) || n < 1)
            throw new Error("expected a whole number of seconds ≥ 1");
          return n;
        },
        brief: "Seconds between project rescans",
        default: "60",
      },
    },
  },
  docs: {
    brief: "Run the claudjar service in the foreground (what the unit runs)",
    fullDescription:
      "Reads /etc/claudjar.conf (CLAUDJAR_CONF overrides), logs the projects " +
      "found under projects_dir — direct children that are a git repo's main " +
      "checkout; linked worktrees and <repo>-worktrees/ folders are excluded — " +
      "records them in ~/.claudjar/service/state.json, and rescans until " +
      "SIGTERM / SIGINT. Must run as the conf's `user`. With `monitor:` set, it " +
      "dials the web interface (/ws/host, authenticated by monitor.token), " +
      "publishes the projects and re-publishes them when a rescan changes them, " +
      "and runs the open / close commands sent from there; the link reconnects " +
      "on its own and never stops the service.\n\n" +
      "Opening a project marks it active and starts a background Claude session " +
      "in its root (`claude --bg`, Remote Control on, named after the project); " +
      "closing it stops that session. Both are recorded in the state file. On " +
      "start the service reconciles the recorded sessions with `claude agents`: " +
      "one still running is re-adopted, one that is gone is marked stopped, and " +
      "the active flags survive. Bring a session to the terminal with " +
      "`claudjar attach <project>`.",
  },
});

const installCommand = buildCommand({
  func: runServiceInstall,
  parameters: {
    flags: {
      bin: {
        kind: "parsed",
        parse: String,
        brief:
          "claudjar executable the unit runs (default: <user home>/.local/bin/claudjar)",
        optional: true,
      },
      dryRun: dryRunFlag,
    },
  },
  docs: {
    brief: "Install and start the systemd system unit (sudo)",
    fullDescription:
      `Writes ${UNIT_PATH} — a system unit with User= set to the conf's ` +
      "`user` — then reloads systemd, enables the unit and (re)starts it. Every " +
      "privileged command is printed before it runs, through sudo unless " +
      "already root. Rerun it to apply a changed conf user or binary path.\n\n" +
      "The unit keeps the default KillMode: background sessions are launched in " +
      "their own `systemd-run --user --scope`, so restarting the service does " +
      "not kill them.",
  },
});

const uninstallCommand = buildCommand({
  func: runServiceUninstall,
  parameters: { flags: { dryRun: dryRunFlag } },
  docs: {
    brief: "Stop, disable and remove the systemd unit (sudo)",
    fullDescription:
      "Leaves /etc/claudjar.conf and the user's ~/.claudjar/service state alone.",
  },
});

const statusCommand = buildCommand({
  func: runServiceStatus,
  parameters: { flags: {} },
  docs: {
    brief: "Show the conf, the unit's state, linger and the service state file",
  },
});

export const serviceRoutes = buildRouteMap({
  routes: {
    run: runCommand,
    install: installCommand,
    uninstall: uninstallCommand,
    status: statusCommand,
  },
  docs: {
    brief: "The per-user claudjar service configured in /etc/claudjar.conf",
    fullDescription:
      "/etc/claudjar.conf (YAML) names the projects folder and the user the " +
      "service runs as:\n\n" +
      "  projects_dir: /home/jarrin/Projects\n" +
      "  user: jarrin\n" +
      "  monitor:\n" +
      "    url: wss://claudjar.jarrin.nl\n" +
      "    token: <secret>\n\n" +
      "Unknown keys and invalid values are errors. `monitor` is optional for now.",
  },
});
