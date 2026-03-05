#!/bin/sh
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

exec node dist/index.js
