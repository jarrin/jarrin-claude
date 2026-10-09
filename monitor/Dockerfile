# claudjar monitor — Nuxt (Nitro, node-server preset) behind the homeserver Caddy.
# Built on the workstation and pushed to zot.jarrin.nl by deploy/deploy.sh.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_DATA_DIR=/data
# .output is self-contained: Nitro traces and copies the runtime dependencies.
COPY --from=build /app/.output ./.output
# Progress boards and open questions; mounted as a volume by the stack.
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
