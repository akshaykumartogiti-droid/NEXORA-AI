# NEXORA AI — Build & Deployment

## Requirements
- Node.js 20+ and Bun 1.1+ (npm also works).
- `bun install` · `bun run dev` (local) · `bun run build` (production) · `bun run test`.

## Architecture
- TanStack Start (React 19, Vite) app; server code runs as an edge/worker function (Cloudflare Workers compatible).
- Backend: Lovable Cloud (managed Postgres + auth). **The app depends on this managed backend.** Moving off it means provisioning your own compatible Postgres/auth project and re-applying the SQL in `drizzle/migrations/`.
- AI: Lovable AI gateway, called only from `src/lib/chat.server.ts` (`/api/chat`). Switching to a direct OpenAI key means changing the provider setup in that one file and setting `OPENAI_API_KEY` as a server secret.

## Environment variables
See `.env.example`. `VITE_*` values are public. Everything else is server-only and must be set as a secret on your host.

## Deploying to an external host (Cloudflare Workers recommended)
1. Push the code to GitHub (Lovable → GitHub sync).
2. On the host, set build command `bun run build`, and add the server env vars as secrets.
3. In the backend auth settings, add your production domain to Site URL / Redirect URLs (needed for email confirmation, password reset and Google sign-in).
4. Deploy, then sign up, confirm email, and send one agent message to verify.

## Troubleshooting
- "Please sign in again" from the agent: session expired or wrong Supabase env vars.
- 429 in chat: per-user limits in `src/lib/limits.ts` (50/day, 6/min).
- Google sign-in redirect error: domain missing from Redirect URLs.

Status: deployment outside Lovable has **not** been performed or verified.
