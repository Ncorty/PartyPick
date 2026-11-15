FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/matching/package.json packages/matching/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/matching/package.json packages/matching/package.json
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/matching/package.json ./packages/matching/package.json
COPY --from=build /app/packages/matching/dist ./packages/matching/dist
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]

FROM caddy:2.10-alpine AS proxy
COPY --from=build /app/apps/web/dist /srv/partypick
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
