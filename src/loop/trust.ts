import { getCACertificates, setDefaultCACertificates } from "node:tls";

let systemCAsTrusted = false;

/**
 * Node trusts only its bundled CAs, so a self-hosted service behind a private CA
 * (git.jarrin.nl, claudjar.jarrin.nl: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while
 * curl is fine) fails every fetch and WebSocket. Add the OS store, as curl and the
 * browser already do.
 */
export function trustSystemCAs(): void {
  if (systemCAsTrusted) return;
  setDefaultCACertificates([
    ...getCACertificates("default"),
    ...getCACertificates("system"),
  ]);
  systemCAsTrusted = true;
}
