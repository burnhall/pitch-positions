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
2. In the dashboard's **SQL Editor**, run each file in `supabase/migrations/` in name order.
   When a new migration file is added later, run just that one.
3. Copy the project URL, publishable key and secret key into `.env.local` (see `.env.example`).
4. **Authentication → URL Configuration**: Site URL is where coaches land after confirming their
   email (`http://localhost:3000` while developing, the real address once deployed).
5. Supabase's built-in email sender only delivers to members of your Supabase organisation and
   only a few emails an hour. Before other coaches sign up, either connect your own email
   service (Authentication → Emails → SMTP settings) or turn off "Confirm email".

## How logins work

- **Coaches**: email + password through Supabase Auth.
- **Players**: no email. The coach adds a nickname; the kid opens a one-time invite link (or
  QR card), picks a 4-digit PIN and is signed in. On a new device they log in with team code +
  nickname + PIN. Behind the scenes each player has an internal login
  (`p-<player id>@players.invalid`) whose password is derived from the PIN with
  `PLAYER_PIN_PEPPER`, so PINs are never stored. 5 wrong PINs lock the player out for 15
  minutes; a new invite from the coach resets the PIN and clears the lock.
