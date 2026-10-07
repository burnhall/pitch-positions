// Pitch formats: size in metres, markings, and the default formation for our team.
// Positions are stored as pitch fractions (0..1) so a situation renders the same on
// any screen. x = 0 is our goal line (we attack left → right), y = 0 is our left touchline.

export type FormatId = "5v5" | "7v7" | "9v9" | "11v11";

export type Point = { x: number; y: number };

/** [position label, shirt number, x, y] */
export type FormationSlot = readonly [label: string, num: number, x: number, y: number];

export type Format = {
  id: FormatId;
  /** pitch length and width in metres */
  L: number;
  W: number;
  /** penalty area [depth, width] */
  area: readonly [number, number];
  /** goal area [depth, width], if the format has one */
  six: readonly [number, number] | null;
  goal: number;
  circle: number;
  spot: number;
  us: readonly FormationSlot[];
};

export const FORMATS: Record<FormatId, Format> = {
  "5v5": {
    id: "5v5", L: 40, W: 30, area: [7, 16], six: null, goal: 3.66, circle: 5, spot: 6,
    us: [["GK", 1, 0.05, 0.5], ["LB", 2, 0.25, 0.27], ["RB", 3, 0.25, 0.73], ["CM", 4, 0.45, 0.5], ["ST", 5, 0.66, 0.5]],
  },
  "7v7": {
    id: "7v7", L: 55, W: 37, area: [9, 24], six: [4, 12], goal: 5, circle: 6, spot: 8,
    us: [["GK", 1, 0.05, 0.5], ["LB", 2, 0.22, 0.3], ["RB", 3, 0.22, 0.7], ["LM", 4, 0.42, 0.15], ["CM", 5, 0.4, 0.5], ["RM", 6, 0.42, 0.85], ["ST", 7, 0.62, 0.5]],
  },
  "9v9": {
    id: "9v9", L: 73, W: 46, area: [13, 32], six: [4.5, 14], goal: 6.4, circle: 7, spot: 9,
    us: [["GK", 1, 0.04, 0.5], ["LB", 3, 0.2, 0.2], ["CB", 4, 0.18, 0.5], ["RB", 2, 0.2, 0.8], ["LCM", 8, 0.38, 0.35], ["RCM", 6, 0.38, 0.65], ["LW", 11, 0.58, 0.15], ["ST", 9, 0.62, 0.5], ["RW", 7, 0.58, 0.85]],
  },
  "11v11": {
    id: "11v11", L: 105, W: 68, area: [16.5, 40.3], six: [5.5, 18.32], goal: 7.32, circle: 9.15, spot: 11,
    us: [["GK", 1, 0.04, 0.5], ["LB", 3, 0.2, 0.15], ["LCB", 4, 0.17, 0.38], ["RCB", 5, 0.17, 0.62], ["RB", 2, 0.2, 0.85], ["CDM", 6, 0.32, 0.5], ["LCM", 8, 0.42, 0.32], ["RCM", 10, 0.42, 0.68], ["LW", 11, 0.6, 0.13], ["ST", 9, 0.64, 0.5], ["RW", 7, 0.6, 0.87]],
  },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export const isFormatId = (v: unknown): v is FormatId => typeof v === "string" && v in FORMATS;

/** Token radius in metres, scaled to the pitch so tokens look the same size in every format. */
export const tokenRadius = (f: Format) => f.W * 0.028;

/** Radius of the coach's answer zone in metres: inside it scores full points. */
export const zoneRadius = (f: Format) => f.W * 0.08;

export const distM = (a: Point, b: Point, f: Format) => Math.hypot((a.x - b.x) * f.L, (a.y - b.y) * f.W);

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
