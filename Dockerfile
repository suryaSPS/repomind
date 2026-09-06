# syntax=docker/dockerfile:1

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
# Install ALL dependencies (incl. devDependencies) once, cached on the lockfile.
FROM node:24-alpine AS deps
# libc6-compat: some native/prebuilt binaries expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ──────────────────────────────────────────────────────────
# Compile the app. `output: 'standalone'` produces .next/standalone with a
# minimal server.js. This stage still has the full source + tsx, so the same
# image is reused by the one-off `migrate` service in docker-compose.
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A placeholder is enough to satisfy `next build` — the real DATABASE_URL is
# injected at runtime. The build never talks to the database.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
# Slim production image: just the standalone output. Repo ingestion is done
# over the GitHub REST API (tarball + commits/diff via fetch), so no `git`
# binary is required here. If you ever switch ingestion to `simple-git`, add
# `git` to this apk install.
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server + the assets it does NOT bundle by design.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Writable clone target for ingested repositories (mounted as a volume in Compose).
RUN mkdir -p /app/data/repos && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

# server.js is emitted by Next's standalone output; it honors PORT/HOSTNAME.
CMD ["node", "server.js"]
