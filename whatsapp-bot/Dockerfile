FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npx tsc

# Create data directory
RUN mkdir -p data auth_info

# Run
CMD ["node", "dist/index.js"]
