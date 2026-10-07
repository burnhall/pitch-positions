# Pitch Positions

A web app that teaches young footballers where to move. Coaches build match situations; players
drag their team to where it should go, live with the team or as homework, and see the coach's
answer straight away. Monthly leaderboard per team.

Product decisions: [docs/PRODUCT.md](docs/PRODUCT.md). The original clickable prototype lives
outside this repo (Google Drive, `Soccer_Positioning_Game/prototype/index.html`).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4). This version differs from older
  Next.js; read the guides in `node_modules/next/dist/docs/` before changing framework code.
- **Supabase**: Postgres database, logins, and live sync.
- Hosting: **Vercel** (website) + **Supabase** (data).

## Project layout

| Path | What |
|---|---|
| `src/lib/pitch/` | Football logic shared by every screen: formats, situations, scoring |
| `src/components/pitch/Pitch.tsx` | The pitch drawing (SVG), with dragging and tapping |
| `src/lib/supabase/` | Database clients: as the signed-in user, or admin (server only) |
| `supabase/migrations/` | Database tables and security rules |
| `supabase/tests/rls.test.mjs` | Checks the security rules on an in-memory Postgres |

## Running it on your Mac

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm run test:db
```

## Setting up Supabase (once)

1. Create a project at supabase.com.
2. In the dashboard's **SQL Editor**, run `supabase/migrations/20261006000000_init.sql`.
3. Copy the project URL, publishable key and secret key into `.env.local` (see `.env.example`).
