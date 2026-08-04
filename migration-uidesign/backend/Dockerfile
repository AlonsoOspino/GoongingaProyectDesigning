FROM node:22-bookworm-slim AS dependencies

WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend ./
# The Express API serves these asset directories directly.
COPY frontend/HeroImages /app/frontend/HeroImages
COPY frontend/MapImages /app/frontend/MapImages

USER node
EXPOSE 3000

CMD ["npm", "start"]
