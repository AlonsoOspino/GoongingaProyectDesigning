FROM node:22-bookworm-slim AS dependencies

WORKDIR /app/minigames-frontend
COPY minigames-frontend/package.json minigames-frontend/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app/minigames-frontend
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOONGINGA_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_GOONGINGA_URL=${NEXT_PUBLIC_GOONGINGA_URL}

COPY --from=dependencies /app/minigames-frontend/node_modules ./node_modules
COPY minigames-frontend ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/minigames-frontend

COPY --from=builder --chown=node:node /app/minigames-frontend ./

USER node
EXPOSE 3001

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
