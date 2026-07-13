# syntax=docker/dockerfile:1

# ---- Base: node + pnpm (via corepack, pinned by package.json#packageManager)
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---- Dependencies (postinstall runs `prisma generate`)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- Build (fully dynamic app: no database or env needed at build time)
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# SKIP_ENV_VALIDATION: the build never touches the database or secrets; env is
# validated at runtime instead (instrumentation.ts).
RUN pnpm exec prisma generate && SKIP_ENV_VALIDATION=1 pnpm build
# Drop dev-only dependencies; `prisma` stays (it is a runtime dependency used
# by `migrate deploy` in the entrypoint).
RUN pnpm prune --prod

# ---- Runtime: standalone server + Prisma CLI for migrations, non-root
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN chown -R node:node /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Prod node_modules (with the Prisma CLI + engines), schema, migrations and the
# Prisma config — everything `prisma migrate deploy` needs at boot.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/lib/generated ./lib/generated
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runs `prisma migrate deploy`, then `node server.js`.
ENTRYPOINT ["./docker-entrypoint.sh"]
