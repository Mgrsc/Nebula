FROM oven/bun:1 AS web-builder
WORKDIR /app
COPY package.json bun.lock ./
COPY web/package.json ./web/package.json
COPY server/package.json ./server/package.json
RUN bun install --frozen-lockfile --filter=nebula-web
COPY web ./web
COPY shared ./shared
WORKDIR /app/web
RUN bun run build

FROM oven/bun:1 AS release
RUN apt-get update && apt-get install -y --no-install-recommends tini curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./
COPY shared ../shared
COPY --from=web-builder /app/web/dist ../web/dist
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/nebula.db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
ENTRYPOINT [ "/usr/bin/tini", "--", "bun", "src/index.ts" ]
