import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Installing Caddy's internal CA into the host trust store.
 *
 * The proxy serves every registered site over HTTPS with certificates signed
 * by its own local CA (`tls internal`). curl and NSS-linked browsers trust
 * that chain only once the CA is anchored in the host trust store — a
 * one-time, sudo-requiring step that `claudjar caddy trust` owns.
 *
 * Both CA certificates are anchored, but the ROOT is the one that matters:
 * Caddy rotates the intermediate routinely and serves it in the TLS chain
 * anyway, so verification never depends on the trust-store copy of it staying
 * current. The root lives in the `claudjar-caddy-data` volume and survives
 * container recreation, which is what makes this a once-per-machine step.
 */

export interface TrustStore {
  /** The rebuild command, which doubles as the flavor's name in output. */
  readonly update: string;
  /** Directory anchor certificates are dropped into. */
  readonly anchorsDir: string;
}

/**
 * The two conventions claudjar's hosts follow. Order matters only if a machine
 * somehow has both anchor directories; first match wins.
 *
 * - Arch-family (p11-kit): the store NSS-linked browsers (Chrome/Chromium)
 *   also read, via the p11-kit trust module — one install covers curl and the
 *   browser.
 * - Debian-family: requires the `.crt` extension, which {@link anchorName}
 *   carries for both flavors.
 */
const STORES: readonly TrustStore[] = [
  {
    update: "update-ca-trust",
    anchorsDir: "/etc/ca-certificates/trust-source/anchors",
  },
  {
    update: "update-ca-certificates",
    anchorsDir: "/usr/local/share/ca-certificates",
  },
];

/** Anchor filename for one of the CA's certs — fixed, so a reinstall overwrites. */
export function anchorName(cert: "root" | "intermediate"): string {
  return `claudjar-caddy-${cert}.crt`;
}

/** Cheap sanity check that a `docker exec cat` really produced a PEM cert. */
export function looksLikeCert(pem: string): boolean {
  return pem.includes("-----BEGIN CERTIFICATE-----");
}

/** Pick this host's trust store; pure given the existence check. */
export function resolveTrustStore(
  dirExists: (path: string) => boolean = existsSync,
): TrustStore | null {
  return STORES.find((store) => dirExists(store.anchorsDir)) ?? null;
}

export interface InstallResult {
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Stage the certs in a temp dir, copy them into the anchors dir, and rebuild
 * the consolidated store. Both privileged steps run through sudo with
 * inherited stdio, so a password prompt reaches the terminal instead of
 * failing a captured spawn.
 */
export function installAnchors(
  store: TrustStore,
  certs: ReadonlyMap<string, string>,
): InstallResult {
  const staging = mkdtempSync(join(tmpdir(), "claudjar-trust-"));
  const staged: string[] = [];
  for (const [name, pem] of certs) {
    const path = join(staging, name);
    writeFileSync(path, pem, "utf8");
    staged.push(path);
  }
  const copied = sudo([
    "install",
    "-m",
    "0644",
    "-t",
    store.anchorsDir,
    ...staged,
  ]);
  if (!copied.ok) return copied;
  return sudo([store.update]);
}

function sudo(args: readonly string[]): InstallResult {
  const res = spawnSync("sudo", [...args], { stdio: "inherit" });
  if (res.error) return { ok: false, detail: res.error.message };
  const status = res.status ?? 1;
  if (status !== 0) {
    return {
      ok: false,
      detail: `\`sudo ${args.join(" ")}\` exited ${String(status)}`,
    };
  }
  return { ok: true, detail: "" };
}
