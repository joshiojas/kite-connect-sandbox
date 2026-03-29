# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Create data directory for SQLite and logs
RUN mkdir -p /data /data/logs && chown -R node:node /data

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY config/ ./config/
COPY src/db/schema.sql ./dist/db/schema.sql

# Non-root user
USER node

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
