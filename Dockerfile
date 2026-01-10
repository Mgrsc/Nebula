FROM oven/bun:1 AS web-builder
WORKDIR /app
COPY web/package.json web/bun.lock ./web/
RUN cd web && bun install --frozen-lockfile
COPY web ./web
COPY shared ./shared
WORKDIR /app/web
RUN bun run build

FROM oven/bun:1 AS release
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./
COPY shared ../shared
COPY --from=web-builder /app/web/dist ../web/dist
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/nebula.db
EXPOSE 3000
ENTRYPOINT [ "bun", "src/index.ts" ]
