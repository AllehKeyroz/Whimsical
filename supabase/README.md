# Supabase setup

1. Open Supabase Studio → **SQL Editor**.
2. Run [`schema.sql`](./schema.sql).
3. Configure the frontend `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Restart Vite (`npm run dev`).
5. Open the app → sidebar **Nuvem** → create/sign in.

For self-hosted Auth email links, set `SITE_URL` and
`ADDITIONAL_REDIRECT_URLS` in the Supabase stack to the frontend origin
(for local dev: `http://localhost:5173`).

Only the anon/publishable key belongs in the browser. The `service_role` key
bypasses RLS and must never be shipped to the client.
