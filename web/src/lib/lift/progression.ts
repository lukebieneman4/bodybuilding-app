/**
 * Progression coach — turns a lift's logged history into a concrete "what to do
 * next session" cue. Hypertrophy is driven by progressive overload near failure,
 * so the logic is deliberately simple and non-prescriptive (it doesn't impose a
 * rep scheme on top of how the athlete already trains):
 *
 *   • left too much in reserve  → push closer to failure first (1–2 RIR)
 *   • training hard, progressing → beat last session (a rep, or a small load bump)
 *   • smoothed e1RM flat for a while → stalled; deload / vary / recover
 *
 * Cited to the same sources as the volume coach (SCIENCE.md §1–2; Schoenfeld /
 * Helms double progression). Toggleable — some athletes progress by feel.
 */

import type { StrengthSeries, StrengthPoint } from './analysis';
import { mixedScale } from './analysis';

export type ProgressionKind = 'overload' | 'intensity' | 'stall';

export interface ProgressionCue {
  kind: ProgressionKind;
  /** Short next-session prescription. */
  headline: string;
  /** One supporting sentence. */
  detail: string;
  cite: string;
}

export interface ProgressionOptions {
  /** RIR at/above which to push intensity before adding work (default 3). */
  hardRIR?: number;
  /** Min points before trusting a "stalled" read (default 4). */
  stallPoints?: number;
  /** %/wk below which the smoothed trend counts as flat (default 0.5). */
  flatPctPerWeek?: number;
}

const OVERLOAD_CITE = 'progressive overload — double progression (Schoenfeld; Helms)';
const RIR_CITE = 'train near failure, ~0–3 RIR (SCIENCE.md §2)';
const STALL_CITE = 'plateau → deload / vary / recover (SCIENCE.md §1)';

const loadStr = (p: StrengthPoint): string => (p.relative ? `+${p.load}` : `${p.load}`);
const fmtPct = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/**
 * Next-session cue for one lift, or null when there isn't enough comparable
 * history (need ≥2 sessions, a single load scale, and a logged top set).
 */
export function progressionCue(series: StrengthSeries, opts: ProgressionOptions = {}): ProgressionCue | null {
  const pts = series.points;
  if (pts.length < 2 || mixedScale(pts)) return null;
  const last = pts[pts.length - 1];
  if (last.load == null || last.reps == null) return null;

  const hardRIR = opts.hardRIR ?? 3;
  const stallPoints = opts.stallPoints ?? 4;
  const flat = opts.flatPctPerWeek ?? 0.5;
  const pctPerWeek = series.current > 0 ? (series.slopePerWeek / series.current) * 100 : 0;

  if (pts.length >= stallPoints && pctPerWeek < flat) {
    return {
      kind: 'stall',
      headline: 'Stalled — change a variable',
      detail: `Top-set strength has been flat (${fmtPct(pctPerWeek)}/wk) for several sessions. A lighter week, an exercise swap, or better recovery (sleep, calories) usually breaks it.`,
      cite: STALL_CITE,
    };
  }

  if (last.rir != null && last.rir >= hardRIR) {
    return {
      kind: 'intensity',
      headline: 'Push closer to failure',
      detail: `Last top set left ~${last.rir} in reserve at ${loadStr(last)}. Take it to 1–2 RIR before adding load — that's where most of the stimulus is.`,
      cite: RIR_CITE,
    };
  }

  return {
    kind: 'overload',
    headline: `Beat ${loadStr(last)}×${last.reps}`,
    detail: `Add a rep (aim ${last.reps + 1}) at ${loadStr(last)}, or a small load bump — keep the top set around 1–2 RIR.`,
    cite: OVERLOAD_CITE,
  };
}
