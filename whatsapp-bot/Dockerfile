FROM node:20-slim

WORKDIR /app

# Install dependencies (production only)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Create persistent directories
RUN mkdir -p data auth_info

# Entrypoint
CMD ["node", "dist/index.js"]
