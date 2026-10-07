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

/** A fresh situation with both teams in their default shape and the ball on the centre spot. */
export function defaultSetup(format: FormatId): SituationSetup {
  const f = FORMATS[format];
  const start: TeamPositions = {};
  for (const [l, , x, y] of f.us) start[l] = { x, y };
  // Mirror our formation, nudged sideways so tokens don't sit on top of each other
  const opp = f.us.map(([l, , x, y]) => ({ x: 1 - x, y: l === "GK" ? 0.5 : clamp01(1 - y + 0.07) }));
  return { title: "", ball: { x: 0.5, y: 0.5 }, pass: null, possession: "opp", opp, start };
}
