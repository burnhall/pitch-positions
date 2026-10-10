"use client";

import { useState } from "react";
import { Pitch, type PitchArrow, type PitchBall, type PitchToken, type PitchZone } from "@/components/pitch/Pitch";
import { Button, Card, inputClass } from "@/components/ui";
import { FORMATS, distM, tokenRadius, type FormatId } from "@/lib/pitch/formats";
import { pct, scorePlayer } from "@/lib/pitch/scoring";
import type { Situation, TeamPositions } from "@/lib/pitch/situation";

export type ReviewAnswer = { playerId: string; nickname: string; situationId: string; positions: TeamPositions; points: number; maxPoints: number };

type Props = { format: FormatId; situations: Situation[]; answers: ReviewAnswer[] };

const scoreClass = (p: number | null) => (p == null ? "" : p >= 80 ? "text-good" : p >= 50 ? "text-ok" : "text-bad");

/** Everyone's answers to one situation on one pitch, for discussing with the team. */
export function ReviewBoard({ format, situations, answers }: Props) {
  const f = FORMATS[format];
  const [cur, setCur] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [onlyPos, setOnlyPos] = useState<string>("");

  const sit = situations[cur];
  const { setup, key } = sit;
  const here = answers.filter((a) => a.situationId === sit.id);
  const focused = here.find((a) => a.playerId === focus) ?? null;
  const positions = onlyPos ? f.us.filter(([l]) => l === onlyPos) : f.us;

  // whole-set totals per player, for the table
  const setTotals = new Map<string, { points: number; max: number; done: number }>();
  for (const a of answers) {
    const t = setTotals.get(a.playerId) ?? { points: 0, max: 0, done: 0 };
    t.points += a.points;
    t.max += a.maxPoints;
    t.done++;
    setTotals.set(a.playerId, t);
  }

  // ---- pitch ----
  const tokens: PitchToken[] = setup.opp.map((pos, i) => ({ id: `opp${i}`, pos, team: "opp" as const }));
  const balls: PitchBall[] = [];
  const arrows: PitchArrow[] = [];
  const zones: PitchZone[] = positions.filter(([l]) => key.model[l]).map(([l]) => ({ pos: key.model[l], label: l }));
  if (setup.pass) {
    arrows.push({ from: setup.ball, to: setup.pass });
    balls.push({ id: "start", pos: setup.ball, possession: setup.possession, opacity: 0.35 });
  }
  for (const [l, n] of positions) tokens.push({ id: `ghost${l}`, pos: setup.start[l], team: "us", num: n, opacity: 0.22 });

  if (focused) {
    for (const [l, n] of positions) {
      const a = focused.positions[l] ?? setup.start[l];
      if (distM(setup.start[l], a, f) > tokenRadius(f)) arrows.push({ from: setup.start[l], to: a });
      const r = scorePlayer(f, setup.start[l], key.model[l], a);
      if (key.model[l] && r && r.s < 100) arrows.push({ from: a, to: key.model[l], miss: true });
      tokens.push({ id: l, pos: a, team: "us", num: n, label: r ? `${l} · ${r.s}` : l });
    }
  } else {
    for (const a of here) {
      for (const [l, n] of positions) {
        const p = a.positions[l];
        if (p) tokens.push({ id: `${a.playerId}:${l}`, pos: p, team: "us", num: n, size: 0.7, opacity: 0.8, tappable: true, label: onlyPos ? a.nickname : undefined });
      }
    }
  }
  balls.push({ id: "ball", pos: setup.pass ?? setup.ball, possession: setup.possession });

  const rows = here
    .map((a) => ({ a, p: pct(a.points, a.maxPoints), set: setTotals.get(a.playerId)! }))
    .sort((x, y) => (x.p ?? 0) - (y.p ?? 0));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-xl border border-line bg-panel p-2.5 lg:sticky lg:top-4">
        <Pitch format={format} tokens={tokens} balls={balls} arrows={arrows} zones={zones}
          onTap={(id) => setFocus(id.split(":")[0])} />
        <p className="mt-2 px-1 text-sm text-muted">
          {focused
            ? `${focused.nickname}'s answer: arrows show each move, labels show points.`
            : "Every player's team as small dots. Dashed circles are your answer. Tap a dot to see that player's whole answer."}
        </p>
      </div>

      <div className="space-y-3">
        <Card>
          <div className="flex flex-wrap gap-1.5" aria-label="Situations">
            {situations.map((s, i) => (
              <button key={s.id} type="button" title={s.setup.title} onClick={() => { setCur(i); setFocus(null); }}
                className={`min-w-9 rounded-lg border px-2.5 py-1.5 ${i === cur ? "border-accent bg-accent text-accent-ink" : "border-line bg-chip hover:border-accent"}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <p className="mt-3 font-semibold">Situation {cur + 1}{setup.title ? `: ${setup.title}` : ""}</p>
          {key.note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-chip p-3 text-sm"><b>Your note:</b> {key.note}</p>}
          <label className="mb-1 mt-3 block text-sm text-muted" htmlFor="only-pos">Show</label>
          <select id="only-pos" className={inputClass} value={onlyPos} onChange={(e) => setOnlyPos(e.target.value)}>
            <option value="">All positions</option>
            {f.us.map(([l, n]) => <option key={l} value={l}>Only #{n} {l} (with names)</option>)}
          </select>
        </Card>

        <Card title={focused ? `${focused.nickname}: ${focused.points} / ${focused.maxPoints}` : `Answers (${here.length})`}>
          {focused ? (
            <>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Player</th><th className="text-right font-normal">Off by</th><th className="text-right font-normal">Points</th></tr></thead>
                <tbody>
                  {f.us.map(([l, n]) => {
                    const r = scorePlayer(f, setup.start[l], key.model[l], focused.positions[l] ?? setup.start[l]);
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
              <Button className="mt-3" onClick={() => setFocus(null)}>◀ Show everyone</Button>
            </>
          ) : rows.length === 0 ? (
            <p className="text-muted">Nobody has answered this situation yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Player</th><th className="text-right font-normal">This one</th><th className="text-right font-normal">Whole set</th></tr></thead>
                <tbody>
                  {rows.map(({ a, p, set }) => (
                    <tr key={a.playerId} className="cursor-pointer border-t border-line hover:bg-chip" onClick={() => setFocus(a.playerId)}>
                      <td className="py-1.5">{a.nickname}</td>
                      <td className={`text-right ${scoreClass(p)}`}>{p ?? "–"}%</td>
                      <td className="text-right">{pct(set.points, set.max) ?? "–"}% <span className="text-muted">({set.done}/{situations.length})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">Lowest first, so you can see who needs help. Tap a player to see their answer.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
