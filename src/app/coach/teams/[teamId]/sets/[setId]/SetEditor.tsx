"use client";

import { useEffect, useState, useTransition } from "react";
import { Pitch, type PitchArrow, type PitchBall, type PitchToken, type PitchZone } from "@/components/pitch/Pitch";
import { Button, Card, FormMessage, inputClass } from "@/components/ui";
import { FORMATS, clamp01, type FormatId, type Point } from "@/lib/pitch/formats";
import { defaultSetup, newId, type Situation } from "@/lib/pitch/situation";
import type { FormState } from "@/lib/form";
import { deleteSet, saveSet, setPublished } from "@/app/coach/actions";

type Props = {
  teamId: string;
  set: { id: string; name: string; format: FormatId; published: boolean };
  initial: Situation[];
  /** how many players have answered each situation, by situation id */
  answerCounts: Record<string, number>;
};

type Layer = "setup" | "answer";

export function SetEditor({ teamId, set, initial, answerCounts }: Props) {
  const f = FORMATS[set.format];
  const [name, setName] = useState(set.name);
  const [sits, setSits] = useState<Situation[]>(initial);
  const [cur, setCur] = useState(0);
  const [layer, setLayer] = useState<Layer>("setup");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const s = sits[Math.min(cur, sits.length - 1)];
  const { setup, key } = s;

  const update = (fn: (s: Situation) => Situation) => {
    setSits((all) => all.map((x, i) => (i === cur ? fn(x) : x)));
    setDirty(true);
    setStatus(null);
  };
  const insertAfter = (next: Situation) => {
    setSits((all) => [...all.slice(0, cur + 1), next, ...all.slice(cur + 1)]);
    setCur(cur + 1);
    setLayer("setup");
    setDirty(true);
    setStatus(null);
  };

  // ---- pitch ----
  const onMove = (id: string, p: Point) => {
    const [kind, k] = id.split(":");
    update((x) => {
      const su = { ...x.setup };
      const ke = { ...x.key };
      if (kind === "ball") su.ball = p;
      else if (kind === "pass") su.pass = p;
      else if (kind === "opp") su.opp = su.opp.map((o, i) => (i === +k ? p : o));
      else if (kind === "start") su.start = { ...su.start, [k]: p };
      else if (kind === "model") ke.model = { ...ke.model, [k]: p };
      return { ...x, setup: su, key: ke };
    });
  };

  const tokens: PitchToken[] = [];
  const balls: PitchBall[] = [];
  const arrows: PitchArrow[] = [];
  const zones: PitchZone[] = [];
  const opps = (draggable: boolean) => setup.opp.forEach((pos, i) => tokens.push({ id: `opp:${i}`, pos, team: "opp", draggable }));

  if (layer === "setup") {
    if (setup.pass) arrows.push({ from: setup.ball, to: setup.pass, strong: true });
    opps(true);
    for (const [l, n] of f.us) tokens.push({ id: `start:${l}`, pos: setup.start[l], team: "us", num: n, label: l, draggable: true });
    if (setup.pass) balls.push({ id: "pass", pos: setup.pass, possession: setup.possession, draggable: true, opacity: 0.55 });
    balls.push({ id: "ball", pos: setup.ball, possession: setup.possession, draggable: true });
  } else {
    if (setup.pass) arrows.push({ from: setup.ball, to: setup.pass });
    opps(false);
    for (const [l, n] of f.us) {
      const m = key.model[l];
      if (m) {
        zones.push({ pos: m, label: l });
        arrows.push({ from: setup.start[l], to: m });
      }
      tokens.push({ id: `ghost:${l}`, pos: setup.start[l], team: "us", num: n, opacity: 0.3 });
    }
    for (const [l, n] of f.us) {
      tokens.push({ id: `model:${l}`, pos: key.model[l] ?? setup.start[l], team: "us", num: n, label: l, draggable: true, dashed: !key.model[l] });
    }
    balls.push({ id: "ball-start", pos: setup.ball, possession: setup.possession, opacity: 0.35 });
    if (setup.pass) balls.push({ id: "ball-end", pos: setup.pass, possession: setup.possession });
  }

  // ---- actions ----
  const keyed = f.us.filter(([l]) => key.model[l]).length;
  const answered = answerCounts[s.id] ?? 0;

  const save = () =>
    startTransition(async () => {
      const r = await saveSet(set.id, { name, situations: sits });
      setStatus(r);
      if (!r?.error) setDirty(false);
    });
  const publish = (on: boolean) =>
    startTransition(async () => {
      if (dirty) {
        const r = await saveSet(set.id, { name, situations: sits });
        if (r?.error) return setStatus(r);
        setDirty(false);
      }
      setStatus(await setPublished(set.id, on));
    });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-xl border border-line bg-panel p-2.5 lg:sticky lg:top-4">
        <Pitch format={set.format} tokens={tokens} balls={balls} arrows={arrows} zones={zones} onMove={onMove} />
        <p className="mt-2 px-1 text-sm text-muted">
          {layer === "setup"
            ? "Drag the ball, opponents and your players into the starting picture. The faded ball is where the pass goes."
            : "Drag each player to where they should end up after the ball moves. Inside the dashed circle scores full points."}
        </p>
      </div>

      <div className="space-y-3">
        <Card>
          <label className="mb-1 block text-sm text-muted" htmlFor="set-name">Homework set name</label>
          <input id="set-name" className={inputClass} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
          <FormMessage state={status} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
            {set.published
              ? <Button onClick={() => publish(false)} disabled={pending}>Hide from players</Button>
              : <Button onClick={() => publish(true)} disabled={pending}>Save and publish</Button>}
          </div>
          <p className="mt-2 text-xs text-muted">
            {set.published ? "Published: your players can see this set." : "Draft: players can't see this set until you publish it."}
          </p>
        </Card>

        <Card title="Situations">
          <div className="flex flex-wrap gap-1.5">
            {sits.map((x, i) => (
              <button key={x.id} type="button" title={x.setup.title} onClick={() => setCur(i)}
                className={`min-w-9 rounded-lg border px-2.5 py-1.5 ${i === cur ? "border-accent bg-accent text-accent-ink" : "border-line bg-chip hover:border-accent"}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Button onClick={() => insertAfter({ id: newId(), setup: defaultSetup(set.format), key: { model: {}, note: "" } })}>+ New situation</Button>
            <Button onClick={() => insertAfter({
              id: newId(),
              setup: {
                ...setup, title: setup.title ? `${setup.title} (cont.)` : "", ball: setup.pass ?? setup.ball, pass: null,
                start: Object.fromEntries(f.us.map(([l]) => [l, key.model[l] ?? setup.start[l]])),
              },
              key: { model: {}, note: "" },
            })}>+ Continue this play</Button>
            <Button onClick={() => insertAfter({ ...structuredClone(s), id: newId() })}>Duplicate</Button>
            <Button variant="danger" disabled={sits.length < 2} onClick={() => {
              const warn = answered ? ` ${answered} player${answered > 1 ? "s have" : " has"} answered it and will lose those points.` : "";
              if (!confirm(`Delete situation ${cur + 1}?${warn} (Nothing is deleted until you save.)`)) return;
              setSits((all) => all.filter((_, i) => i !== cur));
              setCur(Math.max(0, cur - 1));
              setDirty(true);
            }}>Delete</Button>
          </div>
          <p className="mt-2 text-xs text-muted"><b>Continue this play</b> starts where this one ends: the ball at the pass target, players at the answer key.</p>
        </Card>

        <Card title={`Situation ${cur + 1}`}>
          {answered > 0 && <p className="mb-3 rounded-lg bg-ok/10 px-3 py-2 text-xs text-ok">{answered} player{answered > 1 ? "s have" : " has"} answered this. Changes won&apos;t alter points already earned.</p>}
          <label className="mb-1 block text-sm text-muted" htmlFor="sit-title">Title</label>
          <input id="sit-title" className={inputClass} value={setup.title} maxLength={80} placeholder="e.g. Their goal kick, played long"
            onChange={(e) => update((x) => ({ ...x, setup: { ...x.setup, title: e.target.value } }))} />

          <div className="mt-3 flex" role="group" aria-label="Edit">
            {(["setup", "answer"] as const).map((l, i) => (
              <button key={l} type="button" onClick={() => setLayer(l)}
                className={`flex-1 border px-3 py-2 ${i ? "rounded-r-lg" : "rounded-l-lg"} ${layer === l ? "border-accent bg-accent text-accent-ink" : "border-line bg-chip"}`}>
                {l === "setup" ? "1. Setup" : `2. Answer key (${keyed}/${f.us.length})`}
              </button>
            ))}
          </div>

          {layer === "setup" ? (
            <>
              <p className="mb-1 mt-3 text-sm text-muted">Possession</p>
              <div className="flex">
                {(["opp", "us"] as const).map((v, i) => (
                  <button key={v} type="button" onClick={() => update((x) => ({ ...x, setup: { ...x.setup, possession: v } }))}
                    className={`flex-1 border px-3 py-2 ${i ? "rounded-r-lg" : "rounded-l-lg"} ${setup.possession === v ? "border-accent bg-accent text-accent-ink" : "border-line bg-chip"}`}>
                    {v === "opp" ? "Opposition" : "Our team"}
                  </button>
                ))}
              </div>
              <Button className="mt-3" onClick={() => update((x) => ({
                ...x,
                setup: { ...x.setup, pass: x.setup.pass ? null : { x: clamp01(x.setup.ball.x + (x.setup.possession === "us" ? 0.2 : -0.2)), y: x.setup.ball.y } },
              }))}>
                {setup.pass ? "Remove ball movement" : "Add ball movement (pass)"}
              </Button>
            </>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Button onClick={() => update((x) => ({ ...x, key: { ...x.key, model: Object.fromEntries(f.us.map(([l]) => [l, x.key.model[l] ?? x.setup.start[l]])) } }))}>
                Rest stay where they are
              </Button>
              <Button onClick={() => update((x) => ({ ...x, key: { ...x.key, model: {} } }))}>Clear</Button>
            </div>
          )}

          <label className="mb-1 mt-4 block text-sm text-muted" htmlFor="sit-note">Coach&apos;s note (players see it after answering)</label>
          <textarea id="sit-note" rows={3} className={inputClass} maxLength={1000} value={key.note}
            placeholder="e.g. Ball goes long: back line drops, far-side full back tucks in to cover."
            onChange={(e) => update((x) => ({ ...x, key: { ...x.key, note: e.target.value } }))} />
        </Card>

        <form action={deleteSet.bind(null, teamId, set.id)} className="text-right">
          <Button type="submit" variant="danger" className="text-sm"
            onClick={(e) => { if (!confirm("Delete this whole homework set, including all players' answers and points?")) e.preventDefault(); }}>
            Delete homework set
          </Button>
        </form>
      </div>
    </div>
  );
}
