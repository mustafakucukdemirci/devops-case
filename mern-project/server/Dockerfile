# ── Stage 1: dependency resolution ─────────────────────────────────────────
# Isolated stage keeps npm and build toolchain out of the final image.
FROM node:18-alpine AS deps

WORKDIR /app

COPY package*.json ./
# ci ensures lockfile-exact installs; --omit=dev strips devDependencies
RUN npm ci --omit=dev


# ── Stage 2: production runtime ─────────────────────────────────────────────
# Minimal surface: only node binary, app source, and production deps.
FROM node:18-alpine

# Non-root user; UID/GID 1001 aligns with cluster-wide runAsNonRoot policy
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodeuser -u 1001 -G nodejs

WORKDIR /app

COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

USER nodeuser

ENV NODE_ENV=production

EXPOSE 5050

# Probes target /healthcheck — keep in sync with routes/healthcheck.mjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5050/healthcheck || exit 1

CMD ["node", "server.mjs"]
