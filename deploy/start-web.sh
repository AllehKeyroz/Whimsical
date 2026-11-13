#!/bin/sh
# Starts the MCP server in the background and nginx in the foreground.
# If the MCP process exits, it is restarted; nginx keeps serving the app.
set -u

if [ -n "${KDSFLUX_SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -n "${KDSFLUX_SUPABASE_URL:-}" ]; then
  (
    while true; do
      node /app/server/mcp.mjs || true
      echo "kds-flux mcp: restarting in 3s" >&2
      sleep 3
    done
  ) &
else
  echo "kds-flux mcp: KDSFLUX_SUPABASE_* not set; /mcp will return 502" >&2
fi

exec nginx -g 'daemon off;'
