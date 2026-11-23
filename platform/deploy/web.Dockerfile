# syntax=docker/dockerfile:1.7
# Tada web: Next.js standalone server. Build context: the platform/ folder.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm install -g pnpm@10.28.0 --no-fund --no-audit
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL=https://tada.ir
ARG NEXT_PUBLIC_MAP_TILES=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL API_INTERNAL_URL=http://api:4000
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile --filter "@tada/web..."
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @tada/shared build && cd apps/web && npx next build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 API_INTERNAL_URL=http://api:4000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
