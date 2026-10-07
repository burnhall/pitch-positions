import { FORMATS, clamp01, type FormatId, type Point } from "./formats";

/** Positions keyed by our team's position label (e.g. "LB"). */
export type TeamPositions = Record<string, Point>;

/** What every player can see: the picture before they move. */
export type SituationSetup = {
  title: string;
  ball: Point;
  /** where the ball travels to, if it moves */
  pass: Point | null;
  possession: "us" | "opp";
  opp: Point[];
  start: TeamPositions;
};

/** The coach's answer: hidden from a player until they have answered that situation. */
export type SituationKey = {
  model: TeamPositions;
  note: string;
};

export type Situation = { id: string; setup: SituationSetup; key: SituationKey };

/** Random id that also works where crypto.randomUUID doesn't (plain-http LAN addresses). */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A fresh situation with both teams in their default shape and the ball on the centre spot. */
export function defaultSetup(format: FormatId): SituationSetup {
  const f = FORMATS[format];
  const start: TeamPositions = {};
  for (const [l, , x, y] of f.us) start[l] = { x, y };
  // Mirror our formation, nudged sideways so tokens don't sit on top of each other
  const opp = f.us.map(([l, , x, y]) => ({ x: 1 - x, y: l === "GK" ? 0.5 : clamp01(1 - y + 0.07) }));
  return { title: "", ball: { x: 0.5, y: 0.5 }, pass: null, possession: "opp", opp, start };
}
