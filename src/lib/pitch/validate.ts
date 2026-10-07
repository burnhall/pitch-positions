// Cleans situation data arriving from a browser before it is stored or scored: only known
// position labels, finite coordinates clamped to the pitch, bounded text.

import { clamp01, type Format, type Point } from "./formats";
import { defaultSetup, type SituationKey, type SituationSetup, type TeamPositions } from "./situation";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function cleanPoint(v: unknown): Point | null {
  if (!isObj(v)) return null;
  const { x, y } = v;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

export function cleanPositions(f: Format, v: unknown): TeamPositions {
  const out: TeamPositions = {};
  if (!isObj(v)) return out;
  for (const [l] of f.us) {
    const p = cleanPoint(v[l]);
    if (p) out[l] = p;
  }
  return out;
}

export function cleanSetup(f: Format, v: unknown): SituationSetup {
  const d = defaultSetup(f.id);
  if (!isObj(v)) return d;
  const opp = Array.isArray(v.opp) ? v.opp.slice(0, f.us.length).map(cleanPoint).filter((p): p is Point => !!p) : d.opp;
  return {
    title: typeof v.title === "string" ? v.title.trim().slice(0, 80) : "",
    ball: cleanPoint(v.ball) ?? d.ball,
    pass: v.pass == null ? null : cleanPoint(v.pass),
    possession: v.possession === "us" ? "us" : "opp",
    opp,
    // every position needs a starting spot
    start: { ...d.start, ...cleanPositions(f, v.start) },
  };
}

export function cleanKey(f: Format, v: unknown): SituationKey {
  if (!isObj(v)) return { model: {}, note: "" };
  return { model: cleanPositions(f, v.model), note: typeof v.note === "string" ? v.note.slice(0, 1000) : "" };
}

/** Positions with no answer in the key, e.g. ["GK", "ST"]. */
export const missingFromKey = (f: Format, key: SituationKey) => f.us.map(([l]) => l).filter((l) => !key.model[l]);
