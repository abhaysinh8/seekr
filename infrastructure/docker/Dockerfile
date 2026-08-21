FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/crawler/package.json apps/crawler/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/recommendation-core/package.json packages/recommendation-core/package.json
COPY packages/search-core/package.json packages/search-core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tokenizer/package.json packages/tokenizer/package.json
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-dependencies --chown=node:node /workspace/packages ./packages
COPY --from=builder --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /workspace/packages/config/dist ./packages/config/dist
COPY --from=builder --chown=node:node /workspace/packages/recommendation-core/dist ./packages/recommendation-core/dist
COPY --from=builder --chown=node:node /workspace/packages/search-core/dist ./packages/search-core/dist
COPY --from=builder --chown=node:node /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /workspace/packages/tokenizer/dist ./packages/tokenizer/dist
RUN mkdir -p /data/index /data/snapshots && chown -R node:node /data
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

FROM node:24-alpine AS crawler
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /workspace/apps/crawler/node_modules ./apps/crawler/node_modules
COPY --from=production-dependencies --chown=node:node /workspace/packages ./packages
COPY --from=builder --chown=node:node /workspace/apps/crawler/dist ./apps/crawler/dist
COPY --from=builder --chown=node:node /workspace/apps/crawler/package.json ./apps/crawler/package.json
COPY --from=builder --chown=node:node /workspace/packages/config/dist ./packages/config/dist
COPY --from=builder --chown=node:node /workspace/packages/shared/dist ./packages/shared/dist
USER node
CMD ["node", "apps/crawler/dist/runtime.js"]

FROM node:24-alpine AS web
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
