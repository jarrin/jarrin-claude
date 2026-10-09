#!/usr/bin/env sh
# Build + push the claudjar monitor image, copy the stack template to the homeserver,
# and (re)start the stack there. Run from anywhere: `pnpm -C monitor run deploy`.
set -eu

HOST="${HOMESERVER:-jarrin@10.0.0.2}"
REPO="${HOMESERVER_REPO:-/home/jarrin/server-new}"
IMAGE="zot.jarrin.nl/claudjar-monitor:latest"
here="$(cd "$(dirname "$0")" && pwd)"

docker build -t "$IMAGE" "$here/.."
docker push "$IMAGE"

ssh "$HOST" "mkdir -p '$REPO/stacks/claudjar'"
scp "$here/docker-compose.template.yml" "$HOST:$REPO/stacks/claudjar/docker-compose.template.yml"
# `restart` is stop + up, so the freshly pulled :latest is what comes up.
ssh "$HOST" "docker pull '$IMAGE' && cd '$REPO' && ./homeserver restart claudjar -p plain"

echo "deployed — https://claudjar.jarrin.nl"
echo "first deploy only: the new site needs Caddy to reload (./homeserver restart networking:caddy)."
