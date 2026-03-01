#!/bin/bash
# Install the CRM sync LaunchAgent
# Usage: bash install.sh

set -e

PLIST_NAME="com.deltakinetics.keepintouch.crmsync.plist"
PLIST_SRC="$(dirname "$0")/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Installing CRM sync LaunchAgent..."

# Copy plist
cp "$PLIST_SRC" "$PLIST_DST"

# Update paths in plist to current user
sed -i '' "s|/Users/apple2|$HOME|g" "$PLIST_DST"

echo "Installed to: $PLIST_DST"
echo ""
echo "Before loading, update the plist with your CRM URL and API key:"
echo "  CRM_URL: Your Railway app URL"
echo "  CRM_API_KEY: Your API key"
echo ""
echo "To load:   launchctl load $PLIST_DST"
echo "To unload: launchctl unload $PLIST_DST"
echo "To test:   python3 $(dirname "$0")/crm_sync_agent.py"
