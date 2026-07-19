/**
 * Where the standalone binary lives and how to produce it.
 *
 * Shared between `install` (which links it onto PATH and offers to build it when
 * missing) and the docs, so the path and the command are stated once. The build
 * itself lives in `scripts/build-binary.mjs` — see that file for why a SEA is
 * assembled the way it is.
 */

/** Repo-relative path of the standalone executable. */
export const BINARY_REL_PATH = "dist/build/claudjar";

/** The command that produces {@link BINARY_REL_PATH}. */
export const BUILD_BINARY_COMMAND = "pnpm run build";
