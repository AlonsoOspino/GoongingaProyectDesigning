FROM node:22-bookworm-slim AS dependencies

WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json ./
# `npm install` runs `prisma generate` as a postinstall hook, so the schema
# must already be present in this dependency stage.
COPY backend/prisma ./prisma
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend ./
# The Express API serves these asset directories directly.
COPY frontend/HeroImages /app/frontend/HeroImages
COPY frontend/MapImages /app/frontend/MapImages

USER node
EXPOSE 3000

CMD ["npm", "start"]
