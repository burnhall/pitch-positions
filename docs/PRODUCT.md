# Soccer Positioning Game: project notes

A website where a coach builds match scenarios and kids each move their own player to where they'd go.

## Decisions so far (2026-10-06)
- **Formats:** 5v5, 7v7, 9v9, 11v11 (each has its own pitch size and default formation).
- **Where it's used:** live in a big room (coach controls the pace) *and* as homework. Every kid has their own device.
- **Teammate visibility:** coach setting per scenario. Either *visible live* (kids see teammates moving) or *hidden until reveal*.
- **Accounts:** coach registers; coach creates kid IDs (nickname + PIN / team join code). Collect no personal data from kids.

- **Homework is asynchronous:** kids won't be online together. The coach makes a *set* of situations (they don't have to be linked). Each kid places their avatar in every situation and submits whenever suits them. The coach reviews everyone's answers later and discusses them with the team.

- **Homework = whole team (2026-10-06):** in homework each kid moves *every* player, goalkeeper included. Kids switch positions often at this age, and it gets the GK involved.
- **Instant feedback:** after each situation the kid presses "Check my answer" and sees the coach's answer zones, points per player and the coach's note straight away. The coach can still discuss later.
- **Scoring:** up to 100 points per player (inside the zone = 100, falling away outside it). A player left where they started scores 0 unless the answer key really is "stay put".
- **No retries, ever (confirmed 2026-10-06):** one attempt per kid per set. Coming back continues where they left off; finished situations are view-only.
- **Leaderboard:** total points across all homework sets (doing more homework moves you up), plus accuracy %. **Resets every calendar month**: a situation counts towards the month it was checked in. Past months stay viewable.
- **Real version: one leaderboard per team** (a coach may run several teams; kids only ever see their own team's board).

- **Audience (2026-10-06):** the user's own club for now (non-commercial, so free hosting plans are fine). Built multi-coach from day one anyway: any coach can sign up, create a team, add players and invite them.
- **Invites:** the coach adds players by nickname. Each kid gets an invite link / QR code, opens it on their own device and sets a simple PIN. Kids never need an email.
- **Code location:** the real project starts in `~/Downloads/pitch-positions` (outside Google Drive) and moves to GitHub later.

## Modes
- **Coach: build**: sets of situations, each with setup + answer key + note.
- **Live session**: everyone together, coach controls the pace, countdown, reveal.
- **Kid: homework**: name, step through the situations, move the whole team, check → see answer and points, leaderboard at the end.
- **Coach: review**: per situation, every kid's team as small dots over the answer zones; table sorted with the lowest scores first; tap a kid to see their whole answer, with points per player; team leaderboard.

## Core concepts
- **Scenario** = ordered list of **frames**.
- **Frame** = ball start, optional pass (ball movement), possession, opposition positions, our players' start positions, coach's answer key (ideal spot per position), coach's note.
- **Play loop:** ball moves → countdown → each kid drags their player → reveal (all answers, answer zones, scores, coach's note) → next frame.
- "Next frame" carries on from the last one: the ball starts at the previous pass target and players start from the previous answer key.
- Positions are stored as pitch fractions (0–1), so they render the same on any screen.

## Planned stack
- Next.js (React + TypeScript), pitch drawn in SVG
- Supabase: Postgres, coach auth, Realtime for live sessions
- Hosted on Vercel; installable as a PWA on tablets and phones

## Status
- `prototype/index.html`: single-file, single-device clickable prototype (all four modes; live classmates are simulated; homework kids take turns on one browser; data in localStorage + export/import file). No backend. Open it directly in a browser.
