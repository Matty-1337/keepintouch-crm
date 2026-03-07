FROM node:20-slim

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy entrypoint and seed data
COPY entrypoint.sh ./
COPY seed-messages.sql ./
RUN chmod +x entrypoint.sh

# Install ALL dependencies (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Remove dev dependencies after build
RUN npm prune --omit=dev

CMD ["./entrypoint.sh"]
