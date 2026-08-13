FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app

# Runtime only needs express / pg / pngjs — the React + Vite half of the
# dependency tree is build-time and stays behind in the builder stage.
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY api ./api
COPY server.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
