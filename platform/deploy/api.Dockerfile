# syntax=docker/dockerfile:1.7
# Tada API: Fastify + Prisma. Build context: the platform/ folder.
FROM node:22-bookworm-slim AS base
# Servers that cannot reach registry.npmjs.org can point this at an npm mirror.
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV NEXT_TELEMETRY_DISABLED=1 npm_config_registry=$NPM_REGISTRY
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm install -g pnpm@10.28.0 --no-fund --no-audit
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# An optional extra CA (secret "ca") is only for builds behind a TLS-inspecting proxy.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile --filter "@tada/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @tada/shared build \
 && cd apps/api \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npx tsc -p tsconfig.json
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm --filter @tada/api deploy --prod --legacy /out \
 && rm -rf /out/src /out/vitest.config.ts \
 && cp -r apps/api/dist apps/api/prisma apps/api/prisma.config.ts /out/

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /out ./
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
