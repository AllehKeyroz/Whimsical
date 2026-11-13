#!/bin/sh
# Starts the MCP server in the background and nginx in the foreground.
# If the MCP process exits, it is restarted; nginx keeps serving the app.
set -u

# Runtime config for the static bundle (same behavior as the old nginx entrypoint).
target=/usr/share/nginx/html/env.js
escape() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}
url="$(escape "${VITE_SUPABASE_URL:-}")"
key="$(escape "${VITE_SUPABASE_ANON_KEY:-}")"
cat > "$target" <<EOF
window.__WHIM_ENV__ = {
  VITE_SUPABASE_URL: "${url}",
  VITE_SUPABASE_ANON_KEY: "${key}"
};
EOF

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
