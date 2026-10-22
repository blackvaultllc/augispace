# Local development secrets workflow

1. Copy `.dev.vars.example` to `.env.local` (already git-ignored — verify with `git check-ignore .env.local`).
2. Fill in values **locally only**. Never commit this file, and never paste secret values into chat, tickets, or screenshots.
3. To test the direct database connection without persisting anything, set the password only in your shell session:
   ```powershell
   $env:SUPABASE_DB_PASSWORD = '...'   # shell-only, never saved
   node scripts/derive-db-url.mjs
   ```
   Then put the resulting pooler URI in `.env.local` as `DATABASE_URL=`.
4. For the deployed Worker: set the same variable names in the Cloudflare dashboard
   (Workers & Pages → this worker → Settings → Variables and Secrets), marking secrets
   as "Secret". The app cannot read or write deployment secrets at runtime — the admin
   Integrations console only manages the encrypted `integration_settings` rows
   (AbuseIPDB key, AI Gateway key) and runs read-only diagnostics.

## Variable names used by the code

- `DATABASE_URL` — direct Postgres (pooler URI recommended on Cloudflare)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY` (Cloudflare; or store via Admin → Integrations, encrypted)
- `INTEGRATION_SECRET` — optional; master key for the encrypted secrets table
  (falls back to `BETTER_AUTH_SECRET`)
- `SUPABASE_DB_PASSWORD` — transient, shell-only, used by `scripts/derive-db-url.mjs`
