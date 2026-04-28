# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:18-slim AS deps

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:18-slim AS runner

# Security: run as non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=appuser:nodejs . .

# Switch to non-root user
USER appuser

# Cloud Run injects PORT env variable (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check (Cloud Run readiness probe)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server.js"]
