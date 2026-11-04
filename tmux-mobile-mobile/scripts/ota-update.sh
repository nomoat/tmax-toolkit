#!/usr/bin/env bash

set -euo pipefail

CHANNEL="${1:-production}"
MESSAGE="${2:-OTA update $(date -u '+%Y-%m-%d %H:%M UTC')}"

case "$CHANNEL" in
  development|preview|production)
    ;;
  *)
    echo "Invalid channel: $CHANNEL" >&2
    echo "Usage: $0 [development|preview|production] [message]" >&2
    exit 1
    ;;
esac

export APP_ENV="$CHANNEL"
export EAS_UPDATE_CHANNEL="$CHANNEL"
export BUILD_TIME="${BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
export JS_UPDATE_VERSION="${JS_UPDATE_VERSION:-$(date -u '+%Y%m%d.%H%M%S')}"

if [[ "$CHANNEL" == "production" ]]; then
  node scripts/sync-asr.mjs --check
  node scripts/sync-card-actions.mjs --check --deployed https://eng.xyznot.com
fi

echo "Publishing T-MAX OTA"
echo "  channel: $CHANNEL"
echo "  app env: $APP_ENV"
echo "  js version: $JS_UPDATE_VERSION"
echo "  message: $MESSAGE"

npx eas-cli@latest update \
  --channel "$CHANNEL" \
  --environment "$CHANNEL" \
  --platform all \
  --message "$MESSAGE" \
  --non-interactive
