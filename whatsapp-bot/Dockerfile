FROM node:20-slim

WORKDIR /app

# Copy entrypoint early to avoid cache issues
# Paths are relative to repo root (Railway sets context to repo root with RAILWAY_DOCKERFILE_PATH)
COPY whatsapp-bot/entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Install ALL dependencies (including devDeps for build)
COPY whatsapp-bot/package.json whatsapp-bot/package-lock.json ./
RUN npm ci

# Copy source and build
COPY whatsapp-bot/tsconfig.json ./
COPY whatsapp-bot/src/ ./src/
RUN npx tsc

# Remove dev dependencies after build
RUN npm prune --omit=dev

CMD ["./entrypoint.sh"]
