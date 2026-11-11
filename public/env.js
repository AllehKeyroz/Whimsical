// Overwritten at container start by deploy/40-runtime-env.sh using the
// deployment environment variables. In local dev this stays empty and Vite
// falls back to .env.local (VITE_SUPABASE_*).
window.__WHIM_ENV__ = {};
