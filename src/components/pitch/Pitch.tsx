"use client";

import { useId, useRef } from "react";
import { FORMATS, clamp01, tokenRadius, zoneRadius, type Format, type FormatId, type Point } from "@/lib/pitch/formats";

export const PITCH_COLORS = { us: "#2563eb", opp: "#dc2626", zone: "#facc15" } as const;

export type PitchToken = {
  id: string;
  pos: Point;
  team: "us" | "opp";
  num?: number | string;
  label?: string;
  /** can be dragged (onMove) */
  draggable?: boolean;
  /** can be tapped (onTap) */
  tappable?: boolean;
  /** yellow ring: "you", "moved" or "selected" */
  ring?: boolean;
  dashed?: boolean;
  opacity?: number;
  /** size multiplier, 1 = normal */
  size?: number;
};

export type PitchBall = {
  id: string;
  pos: Point;
  possession: "us" | "opp";
  draggable?: boolean;
  opacity?: number;
};

/** strong: white ball movement; miss: yellow dotted line from a player to the zone they should have reached */
export type PitchArrow = { from: Point; to: Point; strong?: boolean; miss?: boolean };

/** One of the coach's answer zones, labelled with its position so players can tell them apart. */
export type PitchZone = { pos: Point; label?: string };

type Props = {
  format: FormatId;
  tokens?: PitchToken[];
  balls?: PitchBall[];
  arrows?: PitchArrow[];
  /** the coach's answer zones */
  zones?: PitchZone[];
  onMove?: (id: string, pos: Point) => void;
  onMoveEnd?: (id: string) => void;
  onTap?: (id: string) => void;
  className?: string;
};

const MARGIN = 3; // metres of grass around the pitch

export function Pitch({ format, tokens = [], balls = [], arrows = [], zones = [], onMove, onMoveEnd, onTap, className }: Props) {
  const f = FORMATS[format];
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);
  const uid = useId().replace(/:/g, "");

  const toPitch = (e: React.PointerEvent): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: clamp01(q.x / f.L), y: clamp01(q.y / f.W) };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest<SVGGElement>("[data-id]");
    if (!el) return;
    const id = el.dataset.id!;
    if (el.dataset.drag === "1") {
      drag.current = id;
      svgRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (el.dataset.tap === "1") {
      onTap?.(id);
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const p = toPitch(e);
    if (p) onMove?.(drag.current, p);
  };
  const endDrag = () => {
    if (!drag.current) return;
    const id = drag.current;
    drag.current = null;
    onMoveEnd?.(id);
  };

  const P = (p: Point) => [p.x * f.L, p.y * f.W] as const;
  const sw = f.W * 0.005;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-MARGIN} ${-MARGIN} ${f.L + 2 * MARGIN} ${f.W + 2 * MARGIN}`}
      className={`block w-full h-auto touch-none select-none ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label={`${format} football pitch`}
    >
      <defs>
        <marker id={`ah-${uid}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#fff" />
        </marker>
        <marker id={`ahs-${uid}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.75)" />
        </marker>
      </defs>

      <PitchMarkings f={f} />

      {zones.map((z, i) => {
        const [x, y] = P(z.pos);
        const zr = zoneRadius(f);
        return (
          <g key={`z${i}`} pointerEvents="none">
            <circle cx={x} cy={y} r={zr} fill="rgba(250,204,21,.16)" stroke={PITCH_COLORS.zone}
              strokeWidth={sw} strokeDasharray={`${sw * 3} ${sw * 2}`} />
            {/* label inside the bottom of the circle: clear of a player standing in the middle,
                whose own label sits above them */}
            {z.label && (
              <text x={x} y={y + zr * 0.62} textAnchor="middle" dominantBaseline="middle" fontSize={tokenRadius(f) * 0.85} fontWeight={700}
                fill={PITCH_COLORS.zone} stroke="rgba(0,0,0,.55)" strokeWidth={tokenRadius(f) * 0.14} paintOrder="stroke"
                fontFamily="system-ui,sans-serif">{z.label}</text>
            )}
          </g>
        );
      })}

      {arrows.filter((a) => a.miss).map((a, i) => {
        const [x1, y1] = P(a.from);
        const [x2, y2] = P(a.to);
        const w = f.W * 0.004;
        return <line key={`m${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={PITCH_COLORS.zone} strokeWidth={w} strokeDasharray={`${w} ${w * 1.6}`} strokeLinecap="round" pointerEvents="none" />;
      })}

      {arrows.filter((a) => !a.miss).map((a, i) => {
        const [x1, y1] = P(a.from);
        const [x2, y2] = P(a.to);
        const w = f.W * (a.strong ? 0.007 : 0.005);
        return (
          <line key={`a${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a.strong ? "#fff" : "rgba(255,255,255,.75)"} strokeWidth={w}
            strokeDasharray={`${w * 3} ${w * 2}`} markerEnd={`url(#${a.strong ? "ah" : "ahs"}-${uid})`} pointerEvents="none" />
        );
      })}

      {tokens.map((t) => <Token key={t.id} f={f} t={t} />)}
      {balls.map((b) => <Ball key={b.id} f={f} b={b} />)}
    </svg>
  );
}

function PitchMarkings({ f }: { f: Format }) {
  const { L, W } = f;
  const sw = W * 0.005;
  const line = { fill: "none", stroke: "rgba(255,255,255,.85)", strokeWidth: sw };
  const gd = Math.min(2, MARGIN * 0.6);
  const stripes = 10;
  return (
    <g pointerEvents="none">
      <rect x={-MARGIN} y={-MARGIN} width={L + 2 * MARGIN} height={W + 2 * MARGIN} fill="#27804a" rx={1} />
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={i} x={(i * L) / stripes} y={0} width={L / stripes} height={W} fill={i % 2 ? "#2c8a4f" : "#319556"} />
      ))}
      <rect x={0} y={0} width={L} height={W} {...line} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} {...line} />
      <circle cx={L / 2} cy={W / 2} r={f.circle} {...line} />
      <circle cx={L / 2} cy={W / 2} r={sw * 1.6} fill="#fff" />
      {[0, 1].map((side) => {
        const box = ([d, w]: readonly [number, number]) => (
          <rect x={side ? L - d : 0} y={(W - w) / 2} width={d} height={w} {...line} />
        );
        return (
          <g key={side}>
            {box(f.area)}
            {f.six && box(f.six)}
            <circle cx={side ? L - f.spot : f.spot} cy={W / 2} r={sw * 1.6} fill="#fff" />
            <rect x={side ? L : -gd} y={(W - f.goal) / 2} width={gd} height={f.goal} fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth={sw} />
          </g>
        );
      })}
    </g>
  );
}

function Token({ f, t }: { f: Format; t: PitchToken }) {
  const r = tokenRadius(f) * (t.size ?? 1);
  const x = t.pos.x * f.L;
  const y = t.pos.y * f.W;
  const interactive = t.draggable || t.tappable;
  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={t.opacity ?? 1}
      data-id={interactive ? t.id : undefined}
      data-drag={t.draggable ? "1" : undefined}
      data-tap={t.tappable ? "1" : undefined}
      pointerEvents={interactive ? undefined : "none"}
      style={{ cursor: t.draggable ? "grab" : t.tappable ? "pointer" : undefined }}
    >
      {interactive && <circle r={r * 2} fill="transparent" />}
      {t.ring && <circle r={r * 1.5} fill="none" stroke={PITCH_COLORS.zone} strokeWidth={r * 0.24} />}
      <circle r={r} fill={PITCH_COLORS[t.team]} stroke="#fff" strokeWidth={r * 0.14}
        strokeDasharray={t.dashed ? `${r * 0.4} ${r * 0.3}` : undefined} />
      {t.num != null && (
        <text y={r * 0.36} textAnchor="middle" fontSize={r} fontWeight={700} fill="#fff" fontFamily="system-ui,sans-serif">{t.num}</text>
      )}
      {t.label && (
        <text y={-r * 1.75} textAnchor="middle" fontSize={r * 0.8} fontWeight={600} fill="#fff" stroke="rgba(0,0,0,.45)"
          strokeWidth={r * 0.12} paintOrder="stroke" fontFamily="system-ui,sans-serif">{t.label}</text>
      )}
    </g>
  );
}

function Ball({ f, b }: { f: Format; b: PitchBall }) {
  const r = tokenRadius(f) * 0.58;
  return (
    <g
      transform={`translate(${b.pos.x * f.L} ${b.pos.y * f.W})`}
      opacity={b.opacity ?? 1}
      data-id={b.draggable ? b.id : undefined}
      data-drag={b.draggable ? "1" : undefined}
      pointerEvents={b.draggable ? undefined : "none"}
      style={{ cursor: b.draggable ? "grab" : undefined }}
    >
      {b.draggable && <circle r={r * 3} fill="transparent" />}
      <circle r={r * 1.7} fill="none" stroke={PITCH_COLORS[b.possession]} strokeWidth={r * 0.35} />
      <circle r={r} fill="#fff" stroke="#111" strokeWidth={r * 0.18} />
      <circle r={r * 0.38} fill="#111" />
    </g>
  );
}
