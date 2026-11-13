# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# KDS FLUX — production image (web + MCP on the same origin)
#
# Build:
#   docker build -t kds-flux \
#     --build-arg VITE_SUPABASE_URL=https://seu-projeto.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=sua-anon-key .
#
# Run:
#   docker run -p 8080:80 \
#     -e KDSFLUX_SUPABASE_URL=https://seu-projeto.supabase.co \
#     -e KDSFLUX_SUPABASE_SERVICE_ROLE_KEY=... kds-flux
#
# The web app is served on :80 and the MCP server runs inside the same
# container on :8788, published through nginx at /mcp. This keeps the URL shown
# in the Integrações panel (current origin + /mcp) valid.
#
# The VITE_* values are baked at build time. The MCP service-role key is only a
# runtime environment variable; it is never included in the static bundle.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_MCP_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MCP_URL=$VITE_MCP_URL

RUN npm run build && npm prune --omit=dev


FROM node:22-alpine AS runtime

RUN apk add --no-cache nginx

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/start-web.sh /app/start-web.sh
RUN chmod +x /app/start-web.sh

ENV MCP_TRANSPORT=http
ENV MCP_PORT=8788
ENV NODE_ENV=production

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["/app/start-web.sh"]
