FROM node:20-slim

WORKDIR /app

# Copy entrypoint early to avoid cache issues
COPY entrypoint.sh ./
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
