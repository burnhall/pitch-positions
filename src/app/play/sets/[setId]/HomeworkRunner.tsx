"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Pitch, type PitchArrow, type PitchBall, type PitchToken, type PitchZone } from "@/components/pitch/Pitch";
import { Button, ButtonLink, Card } from "@/components/ui";
import { FORMATS, distM, lerp, tokenRadius, type FormatId } from "@/lib/pitch/formats";
import { pct, scorePlayer } from "@/lib/pitch/scoring";
import type { SituationKey, SituationSetup, TeamPositions } from "@/lib/pitch/situation";
import { submitAnswer } from "../../actions";

export type Result = { points: number; maxPoints: number; positions: TeamPositions; key: SituationKey };
type Props = {
  set: { name: string; format: FormatId };
  situations: { id: string; setup: SituationSetup; result: Result | null }[];
};

const BALL_MS = 1300;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const scoreClass = (p: number | null) => (p == null ? "" : p >= 80 ? "text-good" : p >= 50 ? "text-ok" : "text-bad");

export function HomeworkRunner({ set, situations }: Props) {
  const f = FORMATS[set.format];
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(situations.filter((s) => s.result).map((s) => [s.id, s.result!])));
  const firstOpen = situations.findIndex((s) => !s.result);
  const start = firstOpen < 0 ? 0 : firstOpen;
  const [cur, setCur] = useState(start);
  const [finished, setFinished] = useState(firstOpen < 0);
  const [draft, setDraft] = useState<TeamPositions>(() => ({ ...situations[start].setup.start }));
  const [ballT, setBallT] = useState(() => (situations[start].setup.pass && firstOpen >= 0 ? 0 : 1));
  const [replay, setReplay] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sit = situations[cur];
  const { setup } = sit;
  const result = results[sit.id];

  // Show the pass once when an unanswered situation opens (and on "Replay ball")
  useEffect(() => {
    if (!setup.pass || results[sit.id]) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / BALL_MS);
      setBallT(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per situation / replay only
  }, [cur, replay]);

  const open = (i: number) => {
    setCur(i);
    setDraft({ ...situations[i].setup.start });
    setBallT(situations[i].setup.pass && !results[situations[i].id] ? 0 : 1);
    setError(null);
    setFinished(false);
  };
  const nextOpen = situations.findIndex((s, i) => i > cur && !results[s.id]) >= 0
    ? situations.findIndex((s, i) => i > cur && !results[s.id])
    : situations.findIndex((s) => !results[s.id]);

  const check = () =>
    startTransition(async () => {
      const r = await submitAnswer(sit.id, draft);
      if ("error" in r) return setError(r.error);
      setResults((all) => ({ ...all, [sit.id]: r }));
    });

  const moved = (l: string) => distM(setup.start[l], draft[l], f) > tokenRadius(f) * 0.5;
  const movedCount = f.us.filter(([l]) => moved(l)).length;

  // ---- pitch ----
  const tokens: PitchToken[] = setup.opp.map((pos, i) => ({ id: `opp${i}`, pos, team: "opp" as const }));
  const balls: PitchBall[] = [];
  const arrows: PitchArrow[] = [];
  const zones: PitchZone[] = [];

  if (result) {
    if (setup.pass) {
      arrows.push({ from: setup.ball, to: setup.pass });
      balls.push({ id: "start", pos: setup.ball, possession: setup.possession, opacity: 0.35 });
    }
    for (const [l, n] of f.us) {
      const m = result.key.model[l];
      if (m) zones.push({ pos: m, label: l });
      tokens.push({ id: `ghost${l}`, pos: setup.start[l], team: "us", num: n, opacity: 0.22 });
      const a = result.positions[l];
      if (a && distM(setup.start[l], a, f) > tokenRadius(f)) arrows.push({ from: setup.start[l], to: a });
    }
    for (const [l, n] of f.us) {
      const a = result.positions[l] ?? setup.start[l];
      const m = result.key.model[l];
      const r = scorePlayer(f, setup.start[l], m, a);
      // a player outside their circle gets a yellow line to where they should have been
      if (m && r && r.s < 100) arrows.push({ from: a, to: m, miss: true });
      tokens.push({ id: l, pos: a, team: "us", num: n, label: r ? `${l} · ${r.s}` : l });
    }
    balls.push({ id: "ball", pos: setup.pass ?? setup.ball, possession: setup.possession });
  } else {
    if (setup.pass) arrows.push({ from: setup.ball, to: setup.pass, strong: ballT < 1 });
    for (const [l, n] of f.us) {
      if (moved(l)) tokens.push({ id: `ghost${l}`, pos: setup.start[l], team: "us", num: n, opacity: 0.22 });
      tokens.push({ id: l, pos: draft[l], team: "us", num: n, label: l, draggable: !pending, ring: moved(l) });
    }
    balls.push({ id: "ball", pos: setup.pass ? lerp(setup.ball, setup.pass, ease(ballT)) : setup.ball, possession: setup.possession });
  }

  // ---- totals ----
  const done = situations.filter((s) => results[s.id]);
  const total = done.reduce((t, s) => t + results[s.id].points, 0);
  const totalMax = done.reduce((t, s) => t + results[s.id].maxPoints, 0);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-xl border border-line bg-panel p-2.5 lg:sticky lg:top-4">
        <Pitch format={set.format} tokens={tokens} balls={balls} arrows={arrows} zones={zones}
          onMove={(id, p) => setDraft((d) => ({ ...d, [id]: p }))} />
      </div>

      <div className="space-y-3">
        <Card>
          <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Situations">
            {situations.map((s, i) => (
              <button key={s.id} type="button" onClick={() => open(i)} title={s.setup.title}
                className={`min-w-9 rounded-lg border px-2.5 py-1.5 ${i === cur && !finished ? "border-accent bg-accent text-accent-ink" : results[s.id] ? "border-accent bg-chip" : "border-line bg-chip"}`}>
                {results[s.id] ? "✓" : i + 1}
              </button>
            ))}
          </div>

          {finished ? (
            <>
              <h2 className="text-lg font-semibold">All done!</h2>
              <p className={`my-2 text-center text-3xl font-bold ${scoreClass(pct(total, totalMax))}`}>{total} points</p>
              <p className="text-center text-sm text-muted">{pct(total, totalMax) ?? 0}% accuracy on &quot;{set.name}&quot;</p>
              <ButtonLink href="/play" variant="primary" className="mt-4 w-full text-center">See the leaderboard</ButtonLink>
            </>
          ) : (
            <>
              <p className="font-semibold">Situation {cur + 1} of {situations.length}{setup.title ? `: ${setup.title}` : ""}</p>
              <p className="mt-1 text-sm text-muted">
                {setup.possession === "opp" ? <>The <b>opposition</b> has the ball.</> : <><b>Our team</b> has the ball.</>}
                {setup.pass ? " The arrow shows where it goes." : ""}
              </p>

              {!result ? (
                <>
                  <p className="mt-3 text-sm">
                    Drag <b>every</b> player to where they should go, goalkeeper too. Moved players get a yellow ring ({movedCount} of {f.us.length}).
                  </p>
                  {error && <p role="alert" className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {setup.pass && <Button onClick={() => { setBallT(0); setReplay((r) => r + 1); }}>▶ Replay ball</Button>}
                    <Button onClick={() => setDraft({ ...setup.start })} disabled={pending}>Reset players</Button>
                  </div>
                  <Button variant="primary" className="mt-3 w-full py-3" onClick={check} disabled={pending}>
                    {pending ? "Checking…" : "Check my answer ✓"}
                  </Button>
                  <p className="mt-2 text-xs text-muted">You get one go at each situation.</p>
                </>
              ) : (
                <ResultPanel f={f} setup={setup} result={result} onNext={() => (nextOpen >= 0 ? open(nextOpen) : setFinished(true))} hasNext={nextOpen >= 0} />
              )}
            </>
          )}
        </Card>
        <p className="text-sm"><Link href="/play" className="text-accent underline">← Back to my homework</Link></p>
      </div>
    </div>
  );
}

function ResultPanel({ f, setup, result, onNext, hasNext }: {
  f: (typeof FORMATS)[FormatId]; setup: SituationSetup; result: Result; onNext: () => void; hasNext: boolean;
}) {
  const p = pct(result.points, result.maxPoints);
  return (
    <>
      <p className={`mt-3 text-center text-3xl font-bold ${scoreClass(p)}`}>{result.points} / {result.maxPoints}</p>
      <p className="text-center text-xs text-muted">points · {p ?? 0}% · inside the dashed circle = 100 per player</p>
      <table className="mt-3 w-full text-sm">
        <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Player</th><th className="text-right font-normal">Off by</th><th className="text-right font-normal">Points</th></tr></thead>
        <tbody>
          {f.us.map(([l, n]) => {
            const r = scorePlayer(f, setup.start[l], result.key.model[l], result.positions[l] ?? setup.start[l]);
            return (
              <tr key={l} className="border-t border-line">
                <td className="py-1">#{n} {l}</td>
                <td className="text-right">{r ? (r.unmoved ? "not moved" : `${r.d.toFixed(1)} m`) : "–"}</td>
                <td className={`text-right ${scoreClass(r?.s ?? null)}`}>{r ? r.s : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.key.note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-chip p-3 text-sm"><b>Coach:</b> {result.key.note}</p>}
      <Button variant="primary" className="mt-3 w-full py-3" onClick={onNext}>{hasNext ? "Next situation ▶" : "Finish ✓"}</Button>
    </>
  );
}
