import { distM, zoneRadius, type Format, type Point } from "./formats";
import type { SituationKey, SituationSetup, TeamPositions } from "./situation";

export type PlayerScore = {
  /** metres from the coach's spot */
  d: number;
  /** 0..100 */
  s: number;
  /** left where they started when the answer was to move */
  unmoved?: boolean;
};

/** "Didn't move" tolerance in metres: small nudges count as not moved. */
const unmovedTolerance = (f: Format) => f.W * 0.014;

/**
 * Score one player: 100 inside the coach's zone, falling to 0 at 2.5 zone-widths beyond it.
 * A player left where they started scores 0 unless the answer really is "stay put".
 */
export function scorePlayer(f: Format, start: Point | undefined, model: Point | undefined, ans: Point | undefined): PlayerScore | null {
  if (!model || !ans) return null;
  const d = distM(ans, model, f);
  const z = zoneRadius(f);
  if (start && distM(ans, start, f) < unmovedTolerance(f) && distM(start, model, f) > z) return { d, s: 0, unmoved: true };
  return { d, s: d <= z ? 100 : Math.max(0, Math.round(100 - ((d - z) / z) * 40)) };
}

export type SituationScore = {
  points: number;
  maxPoints: number;
  perPlayer: Record<string, PlayerScore>;
};

/** Whole-team score: up to 100 points per position that has an answer key. */
export function scoreSituation(f: Format, setup: SituationSetup, key: SituationKey, answer: TeamPositions): SituationScore {
  let points = 0;
  let maxPoints = 0;
  const perPlayer: Record<string, PlayerScore> = {};
  for (const [l] of f.us) {
    if (!key.model[l]) continue;
    maxPoints += 100;
    const r = scorePlayer(f, setup.start[l], key.model[l], answer[l]);
    if (r) {
      perPlayer[l] = r;
      points += r.s;
    }
  }
  return { points, maxPoints, perPlayer };
}

export const pct = (points: number, maxPoints: number) => (maxPoints ? Math.round((points / maxPoints) * 100) : null);
