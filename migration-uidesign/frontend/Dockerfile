FROM node:22-bookworm-slim AS dependencies

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install

FROM node:22-bookworm-slim AS builder

WORKDIR /app/frontend
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=dependencies /app/frontend/node_modules ./node_modules
COPY frontend ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/frontend

COPY --from=builder --chown=node:node /app/frontend ./

USER node
EXPOSE 3001

CMD ["npm", "run", "start", "--", "-p", "3001", "-H", "0.0.0.0"]
