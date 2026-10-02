FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV AUTUMN27_TARGET=sqlite
RUN pnpm run build:selfhost

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production AUTUMN27_TARGET=sqlite PORT=3000 HOST=0.0.0.0 AUTUMN27_DATABASE_PATH=/app/storage/workspace.sqlite
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/start-selfhost.mjs ./scripts/start-selfhost.mjs
COPY --from=build /app/db/sqlite-binding.mjs ./db/sqlite-binding.mjs
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
VOLUME ["/app/storage"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/favicon.svg').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-selfhost.mjs"]
