<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Product decisions live in `docs/PRODUCT.md`; check it before changing game rules (scoring, no retries, monthly leaderboard per team).
- Security is enforced in the database (`supabase/migrations/`), not only in the app. After changing a migration, run `npm run test:db` and extend `supabase/tests/rls.test.mjs` for any new rule.
- Kids' accounts never use real emails. Answers are scored on the server and written with the admin client; users can't write answers directly.
