FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
RUN pnpm build:offline
FROM build AS runtime
ENV NODE_ENV=production
USER node
CMD ["node","--import","./dist/apps/api/instrumentation.mjs","dist/apps/api/main.mjs"]
