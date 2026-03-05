FROM node:20-slim

WORKDIR /app

# Install dependencies (production only)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Create persistent directory structure
# On Railway, /app/persist is a mounted volume
RUN mkdir -p persist/auth_info persist/data data auth_info

# Entrypoint
CMD ["node", "dist/index.js"]
