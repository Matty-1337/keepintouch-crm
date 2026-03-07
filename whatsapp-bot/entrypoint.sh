#!/bin/sh
echo "[entrypoint] Starting KIT WhatsApp Bot..."
echo "[entrypoint] Node version: $(node --version)"

AUTH_DIR="${AUTH_DIR:-/app/auth_info}"
DB_PATH="${DB_PATH:-/app/data/whatsapp-bot.db}"
DB_DIR=$(dirname "$DB_PATH")

# Clear auth state if requested
if [ "$CLEAR_AUTH" = "true" ] && [ -d "$AUTH_DIR" ]; then
  echo "CLEAR_AUTH=true — wiping auth state..."
  rm -rf "$AUTH_DIR"/*
  echo "Auth state cleared."
fi

# Ensure directories exist
mkdir -p "$AUTH_DIR" "$DB_DIR"

echo "[entrypoint] AUTH_DIR=$AUTH_DIR"
echo "[entrypoint] DB_PATH=$DB_PATH"

# Import seed messages on first run (if seed file exists and marker doesn't)
SEED_MARKER="$DB_DIR/.seed-imported"
if [ -f /app/seed-messages.sql ] && [ ! -f "$SEED_MARKER" ]; then
  echo "[entrypoint] Importing seed messages into database..."
  # Ensure DB exists with schema first
  node -e "require('./dist/storage').getDb(); require('./dist/storage').closeDb();"
  sqlite3 "$DB_PATH" < /app/seed-messages.sql
  echo "[entrypoint] Seed import complete: $(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM messages') messages in DB"
  touch "$SEED_MARKER"
fi

echo "[entrypoint] Checking dist/index.js..."
ls -la /app/dist/index.js 2>&1 || echo "[entrypoint] ERROR: dist/index.js not found!"
echo "[entrypoint] Launching node dist/index.js..."

exec node dist/index.js
