FROM node:20-slim

WORKDIR /app

# Install ALL dependencies (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create persistent directory structure
# On Railway, /app/persist is a mounted volume
RUN mkdir -p persist/auth_info persist/data data auth_info

# Entrypoint
CMD ["node", "dist/index.js"]
