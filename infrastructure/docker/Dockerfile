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

FROM node:24-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /workspace /app
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

FROM node:24-alpine AS crawler
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /workspace /app
CMD ["node", "apps/crawler/dist/index.js"]

FROM node:24-alpine AS web
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
