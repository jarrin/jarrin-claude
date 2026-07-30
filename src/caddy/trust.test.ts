import { describe, expect, it } from "vitest";

import { anchorName, looksLikeCert, resolveTrustStore } from "./trust.js";

describe("resolveTrustStore", () => {
  it("picks the Arch-family store when its anchors dir exists", () => {
    const store = resolveTrustStore(
      (path) => path === "/etc/ca-certificates/trust-source/anchors",
    );
    expect(store?.update).toBe("update-ca-trust");
  });

  it("falls back to the Debian-family store", () => {
    const store = resolveTrustStore(
      (path) => path === "/usr/local/share/ca-certificates",
    );
    expect(store?.update).toBe("update-ca-certificates");
  });

  it("returns null on a host with neither, rather than guessing a path", () => {
    expect(resolveTrustStore(() => false)).toBeNull();
  });
});

describe("anchorName", () => {
  it("is fixed per cert, so a reinstall overwrites instead of accumulating", () => {
    expect(anchorName("root")).toBe("claudjar-caddy-root.crt");
    expect(anchorName("intermediate")).toBe("claudjar-caddy-intermediate.crt");
  });

  it("carries the .crt extension update-ca-certificates requires", () => {
    expect(anchorName("root").endsWith(".crt")).toBe(true);
  });
});

describe("looksLikeCert", () => {
  it("accepts a PEM certificate and rejects error output", () => {
    expect(looksLikeCert("-----BEGIN CERTIFICATE-----\nMIIB…")).toBe(true);
    // What a failed `docker exec cat` would have produced on stdout: nothing.
    expect(looksLikeCert("")).toBe(false);
    expect(looksLikeCert("cat: can't open file")).toBe(false);
  });
});
