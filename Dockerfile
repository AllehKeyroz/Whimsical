# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Whimsical Clone — production image
#
# Build:
#   docker build -t whimsical-clone \
#     --build-arg VITE_SUPABASE_URL=https://seu-projeto.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=sua-anon-key .
#
# Run:
#   docker run -p 8080:80 whimsical-clone
#
# The two VITE_* values are compiled into the bundle at build time. They are
# optional: without them the app runs fully local and the "Nuvem" panel asks
# for URL + anon key at runtime (stored in the browser only).
# Never pass the service_role key here — it would be shipped to the browser.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
