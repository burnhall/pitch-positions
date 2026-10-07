"use client";

import { useState } from "react";
import { FORMATS, FORMAT_IDS, type FormatId, type Point } from "@/lib/pitch/formats";
import { defaultSetup } from "@/lib/pitch/situation";
import { Pitch, type PitchToken } from "./Pitch";

/** Landing-page pitch: switch formats and drag your team around. */
export function PitchDemo() {
  const [format, setFormat] = useState<FormatId>("7v7");
  const [setup, setSetup] = useState(() => defaultSetup("7v7"));

  const changeFormat = (id: FormatId) => {
    setFormat(id);
    setSetup(defaultSetup(id));
  };
  const move = (id: string, pos: Point) => setSetup((s) => ({ ...s, start: { ...s.start, [id]: pos } }));

  const tokens: PitchToken[] = [
    ...setup.opp.map((pos, i) => ({ id: `opp${i}`, pos, team: "opp" as const })),
    ...FORMATS[format].us.map(([l, n]) => ({ id: l, pos: setup.start[l], team: "us" as const, num: n, label: l, draggable: true })),
  ];

  return (
    <div className="rounded-xl border border-line bg-panel p-2.5">
      <div className="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Pitch format">
        {FORMAT_IDS.map((id) => (
          <button key={id} type="button" onClick={() => changeFormat(id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${id === format ? "border-accent bg-accent text-accent-ink" : "border-line bg-chip hover:border-accent"}`}>
            {id}
          </button>
        ))}
      </div>
      <Pitch format={format} tokens={tokens} balls={[{ id: "ball", pos: setup.ball, possession: setup.possession }]} onMove={move} />
      <p className="mt-2 px-1 text-sm text-muted">Drag the blue players. We attack left to right.</p>
    </div>
  );
}
