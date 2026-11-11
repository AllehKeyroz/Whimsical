#!/bin/sh
# Runs automatically by the official nginx entrypoint before nginx starts.
# Generates /env.js from the container environment so the static bundle can be
# configured with Easypanel/Docker environment variables (no rebuild needed).
set -eu

target="/usr/share/nginx/html/env.js"

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

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "runtime-env: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set; the app will report Supabase as not configured."
else
  echo "runtime-env: Supabase credentials injected from environment."
fi
