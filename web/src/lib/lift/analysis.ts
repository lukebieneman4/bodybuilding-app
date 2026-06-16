/**
 * Lift analysis core (M5, Phase C): strength trend, weekly volume per muscle, and
 * left/right asymmetry — built on the parsed sessions and SCIENCE.md.
 *
 * Strength is one more noisy biological time series, so the per-exercise e1RM
 * series is run through the SAME shared Kalman estimator the bodyweight engine
 * uses (`core/estimator`) — trend + slope + confidence band, once, for both.
 *
 * Identity: e1RM/asymmetry are scoped per `exercise key × location × limb` (a
 * machine's stack units aren't comparable across gyms). Weekly volume is
 * location-agnostic (a hard set counts anywhere).
 */

import { smooth } from '../core/estimator';
import { dayDiff } from '../core/analysis';
import type { LiftSession, Limb } from './types';
import { estimateE1RM, isHardSet, type Confidence } from './e1rm';
import {
  musclesFor,
  volumeStatus,
  PRIMARY_CREDIT,
  SECONDARY_CREDIT,
  LANDMARKS,
  type Muscle,
  type Landmark,
  type VolumeStatus,
} from './muscles';

// ---- time axis --------------------------------------------------------------

interface DatedSession {
  session: LiftSession;
  day: number;
  date: string | null;
}

/**
 * Assign a day offset to each session. Uses ISO dates when every session has one
 * (sorted ascending); otherwise falls back to session order (one unit apart).
 * Cadence-based dating from the title is a separate import-step concern.
 */
function withDays(sessions: LiftSession[]): DatedSession[] {
  const allDated = sessions.length > 0 && sessions.every((s) => s.date != null);
  if (allDated) {
    const sorted = [...sessions].sort((a, b) => a.date!.localeCompare(b.date!));
    const first = sorted[0].date!;
    return sorted.map((session) => ({ session, day: dayDiff(first, session.date!), date: session.date }));
  }
  return sessions.map((session, i) => ({ session, day: i, date: session.date }));
}

// ---- per-session top-set collection -----------------------------------------

export interface StrengthPoint {
  day: number;
  date: string | null;
  e1rm: number;
  confidence: Confidence;
  /** True when the winning set's load was a relative "+N" (over-stack) value. */
  relative: boolean;
}

interface RawSeries {
  key: string;
  rawName: string;
  location: string | null;
  limb: Limb | null;
  points: StrengthPoint[];
}

/** Collect the best (top-set) e1RM per session for each exercise×location×limb. */
function collect(sessions: LiftSession[]): Map<string, RawSeries> {
  const out = new Map<string, RawSeries>();
  for (const { session, day, date } of withDays(sessions)) {
    for (const ex of session.exercises) {
      // best e1RM per limb within this exercise on this day
      const best = new Map<string, { e1rm: number; confidence: Confidence; limb: Limb | null; relative: boolean }>();
      for (const set of ex.sets) {
        const e = estimateE1RM(set);
        if (!e) continue;
        const lk = set.limb ?? '';
        const cur = best.get(lk);
        if (!cur || e.value > cur.e1rm)
          best.set(lk, { e1rm: e.value, confidence: e.confidence, limb: set.limb, relative: set.load.relative });
      }
      for (const [, b] of best) {
        const sk = `${ex.key}|${session.location ?? ''}|${b.limb ?? ''}`;
        let series = out.get(sk);
        if (!series) {
          series = { key: ex.key, rawName: ex.rawName, location: session.location, limb: b.limb, points: [] };
          out.set(sk, series);
        }
        series.points.push({ day, date, e1rm: b.e1rm, confidence: b.confidence, relative: b.relative });
      }
    }
  }
  for (const s of out.values()) s.points.sort((a, b) => a.day - b.day);
  return out;
}

// ---- strength trend ---------------------------------------------------------

export interface StrengthSeries extends RawSeries {
  /** Smoothed e1RM trend at each point. */
  trend: number[];
  /** 95% band [lo, hi] at each point. */
  band: [number, number][];
  /** Current (last) trend value. */
  current: number;
  /** Trend slope in stack-units per week (signed; > 0 = getting stronger). */
  slopePerWeek: number;
}

// Scale the bodyweight-validated filter constants to this series' magnitude so
// the smoother behaves the same on machine-load numbers as on kilograms.
const BW_MEDIAN_KG = 85; // reference scale the core defaults were tuned at
function trendParams(values: number[]): { R: number; q: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 1;
  const R = (0.04 * med) ** 2; // ~4% per-session measurement noise
  const q = 2.5e-4 * (med / BW_MEDIAN_KG) ** 2; // core DEFAULT_Q, scale-adjusted
  return { R, q };
}

/** Strength trend per exercise×location×limb, smoothed by the shared estimator. */
export function strengthSeries(sessions: LiftSession[]): StrengthSeries[] {
  const raw = collect(sessions);
  const out: StrengthSeries[] = [];
  for (const s of raw.values()) {
    if (s.points.length < 2) {
      // not enough to smooth — surface the flat point(s) as-is
      const v = s.points.map((p) => p.e1rm);
      out.push({
        ...s,
        trend: v,
        band: v.map((x) => [x, x] as [number, number]),
        current: v[v.length - 1] ?? 0,
        slopePerWeek: 0,
      });
      continue;
    }
    const days = s.points.map((p) => p.day);
    const vals = s.points.map((p) => p.e1rm);
    const r = smooth(days, vals, trendParams(vals));
    out.push({
      ...s,
      trend: r.trend,
      band: r.trend.map((t, i) => [t - 1.96 * r.trendSd[i], t + 1.96 * r.trendSd[i]]),
      current: r.trend[r.trend.length - 1],
      slopePerWeek: r.slope[r.slope.length - 1] * 7,
    });
  }
  return out;
}

// ---- strength summary (normalized progression) ------------------------------

export interface SummaryPoint {
  day: number;
  /** Strength as a percentage of this exercise's own first-session baseline. */
  pct: number;
}

export interface SummaryLine {
  /** Exercise name (by-exercise mode) or muscle name (by-muscle mode). */
  label: string;
  /** Primary muscle group, for colour grouping; null if unmapped. */
  muscle: Muscle | null;
  points: SummaryPoint[];
}

export interface StrengthSummary {
  /** One normalized line per exercise×location×limb (coloured by muscle). */
  byExercise: SummaryLine[];
  /** One line per muscle group: mean normalized progress of its exercises. */
  byMuscle: SummaryLine[];
  dayMax: number;
}

export interface SummaryOptions {
  /** Minimum e1RM points an exercise needs to appear in the summary. */
  minPoints?: number;
}

/** A series mixing relative "+N" and absolute loads isn't self-comparable. */
export function mixedScale(points: StrengthPoint[]): boolean {
  return points.some((p) => p.relative) && points.some((p) => !p.relative);
}

/** Linear-interpolate a normalized line at `day`, or null if outside its span. */
export function interpAt(points: SummaryPoint[], day: number): number | null {
  if (points.length === 0 || day < points[0].day || day > points[points.length - 1].day) return null;
  for (let i = 1; i < points.length; i++) {
    if (day <= points[i].day) {
      const a = points[i - 1];
      const b = points[i];
      if (b.day === a.day) return b.pct;
      return a.pct + ((day - a.day) / (b.day - a.day)) * (b.pct - a.pct);
    }
  }
  return points[points.length - 1].pct;
}

/**
 * Overall strength-progress summary. Each exercise's SMOOTHED e1RM trend is
 * indexed to its own first-session value (= 100%), making otherwise
 * incomparable machine-unit series comparable as *relative progress*. This is
 * the only honest way to put multiple exercises on one axis — never raw e1RM.
 *
 * `byMuscle` averages each group's normalized curves on a shared day grid,
 * counting only exercises active within their own span at that day. (A caveat:
 * when a new exercise enters mid-window at 100%, it nudges the group mean toward
 * 100 — cohort-composition drift; minor here since most lifts span the window.)
 */
export function strengthSummary(sessions: LiftSession[], opts: SummaryOptions = {}): StrengthSummary {
  const minPoints = opts.minPoints ?? 3;
  const series = strengthSeries(sessions).filter(
    (s) => s.points.length >= minPoints && s.trend[0] > 0 && !mixedScale(s.points)
  );

  const lines = series.map((s) => {
    const base = s.trend[0];
    const points: SummaryPoint[] = s.points.map((p, i) => ({ day: p.day, pct: (s.trend[i] / base) * 100 }));
    const muscle = musclesFor(s.key)?.primary[0] ?? null;
    return { label: `${s.rawName}${s.limb ? ' (' + s.limb + ')' : ''}`, muscle, points };
  });
  const dayMax = lines.length ? Math.max(...lines.flatMap((l) => l.points.map((p) => p.day))) : 0;

  // shared grid (~30 steps) for the per-muscle aggregate
  const step = Math.max(1, Math.round(dayMax / 30));
  const grid: number[] = [];
  for (let d = 0; d <= dayMax; d += step) grid.push(d);
  if (grid[grid.length - 1] !== dayMax && dayMax > 0) grid.push(dayMax);

  const byGroup = new Map<Muscle, SummaryLine[]>();
  for (const l of lines) {
    if (l.muscle == null) continue;
    const g = byGroup.get(l.muscle) ?? [];
    g.push(l);
    byGroup.set(l.muscle, g);
  }
  const byMuscle: SummaryLine[] = [];
  for (const [muscle, ls] of byGroup) {
    const points: SummaryPoint[] = [];
    for (const day of grid) {
      const vals = ls.map((l) => interpAt(l.points, day)).filter((v): v is number => v != null);
      if (vals.length) points.push({ day, pct: vals.reduce((a, b) => a + b, 0) / vals.length });
    }
    if (points.length >= 2) byMuscle.push({ label: muscle, muscle, points });
  }
  byMuscle.sort((a, b) => (b.points[b.points.length - 1]?.pct ?? 0) - (a.points[a.points.length - 1]?.pct ?? 0));

  const byExercise = [...lines].sort((a, b) => (a.muscle ?? '').localeCompare(b.muscle ?? ''));
  return { byExercise, byMuscle, dayMax };
}

// ---- weekly volume per muscle ----------------------------------------------

/** One exercise's share of a muscle's weekly volume — the audit trail behind the number. */
export interface VolumeContribution {
  rawName: string;
  /** Whether this exercise is a primary mover (1.0/set) or secondary (0.5/set) for the muscle. */
  role: 'primary' | 'secondary';
  creditPerSet: number;
  /** Raw hard-set count in the window (each worked limb counted separately). */
  hardSets: number;
  /** This exercise's contribution to the muscle's weekly total. */
  setsPerWeek: number;
}

export interface MuscleVolume {
  muscle: Muscle;
  /** Weekly hard-set credits (fractional: primary 1.0, secondary 0.5). */
  setsPerWeek: number;
  status: VolumeStatus;
  landmark: Landmark | null;
  /** Per-exercise breakdown of where setsPerWeek comes from (largest first). */
  contributions: VolumeContribution[];
}

export interface VolumeOptions {
  /** Trailing window ending at the last session, in days (default 7). */
  windowDays?: number;
}

/**
 * Weekly hard-set credits per muscle over the trailing window, with landmark
 * status. Unilateral sets count per worked limb (a `225/90` leg press = 2 quad
 * credits); zero-rep surgical-side sets credit nothing (SCIENCE.md §4).
 */
export function weeklyVolumeByMuscle(sessions: LiftSession[], opts: VolumeOptions = {}): MuscleVolume[] {
  const windowDays = opts.windowDays ?? 7;
  const dated = withDays(sessions);
  if (dated.length === 0) return [];
  const lastDay = Math.max(...dated.map((d) => d.day));
  const cutoff = lastDay - windowDays;

  // accumulate hard-set counts per muscle, keyed by exercise (merged across gyms)
  interface Acc {
    rawName: string;
    role: 'primary' | 'secondary';
    creditPerSet: number;
    hardSets: number;
  }
  const byMuscle = new Map<Muscle, Map<string, Acc>>();
  const bump = (m: Muscle, exKey: string, rawName: string, role: 'primary' | 'secondary', creditPerSet: number, n: number) => {
    let mm = byMuscle.get(m);
    if (!mm) byMuscle.set(m, (mm = new Map()));
    const cur = mm.get(exKey);
    if (cur) cur.hardSets += n;
    else mm.set(exKey, { rawName, role, creditPerSet, hardSets: n });
  };
  for (const { session, day } of dated) {
    if (day <= cutoff) continue;
    for (const ex of session.exercises) {
      const att = musclesFor(ex.key);
      if (!att) continue;
      const n = ex.sets.filter(isHardSet).length;
      if (n === 0) continue;
      for (const m of att.primary) bump(m, ex.key, ex.rawName, 'primary', PRIMARY_CREDIT, n);
      for (const m of att.secondary) bump(m, ex.key, ex.rawName, 'secondary', SECONDARY_CREDIT, n);
    }
  }

  const perWeek = windowDays / 7;
  const out: MuscleVolume[] = [];
  for (const [muscle, mm] of byMuscle) {
    const contributions: VolumeContribution[] = [...mm.values()]
      .map((a) => ({
        rawName: a.rawName,
        role: a.role,
        creditPerSet: a.creditPerSet,
        hardSets: a.hardSets,
        setsPerWeek: (a.creditPerSet * a.hardSets) / perWeek,
      }))
      .sort((x, y) => y.setsPerWeek - x.setsPerWeek);
    const setsPerWeek = contributions.reduce((s, c) => s + c.setsPerWeek, 0);
    out.push({ muscle, setsPerWeek, status: volumeStatus(muscle, setsPerWeek), landmark: LANDMARKS[muscle] ?? null, contributions });
  }
  return out.sort((a, b) => b.setsPerWeek - a.setsPerWeek);
}

// ---- left/right asymmetry (LSI) --------------------------------------------

export interface AsymmetryPoint {
  day: number;
  date: string | null;
  healthy: number;
  surgical: number;
  /** Limb Symmetry Index = surgical / healthy × 100 (SCIENCE.md §5). */
  lsi: number;
}

export interface AsymmetrySeries {
  key: string;
  rawName: string;
  location: string | null;
  points: AsymmetryPoint[];
  currentLSI: number;
}

export interface AsymmetryOptions {
  /** Which limb is the surgical/recovering side (default 'R' per the user's log). */
  surgicalSide?: Limb;
}

/**
 * Per-exercise left/right Limb Symmetry Index over time, for any exercise logged
 * with both limbs. LSI is a training-progress proxy, NOT medical clearance.
 */
export function limbAsymmetry(sessions: LiftSession[], opts: AsymmetryOptions = {}): AsymmetrySeries[] {
  const surgical = opts.surgicalSide ?? 'R';
  const raw = collect(sessions);
  // index limb series by exercise×location
  const byExercise = new Map<string, { L?: RawSeries; R?: RawSeries; rawName: string; location: string | null; key: string }>();
  for (const s of raw.values()) {
    if (s.limb == null) continue;
    const ek = `${s.key}|${s.location ?? ''}`;
    const g = byExercise.get(ek) ?? { rawName: s.rawName, location: s.location, key: s.key };
    g[s.limb] = s;
    byExercise.set(ek, g);
  }

  const out: AsymmetrySeries[] = [];
  for (const g of byExercise.values()) {
    if (!g.L || !g.R) continue;
    const surgSeries = surgical === 'R' ? g.R : g.L;
    const healthySeries = surgical === 'R' ? g.L : g.R;
    const healthyByDay = new Map(healthySeries.points.map((p) => [p.day, p.e1rm]));
    const points: AsymmetryPoint[] = [];
    for (const p of surgSeries.points) {
      const h = healthyByDay.get(p.day);
      if (h == null || h <= 0) continue;
      points.push({ day: p.day, date: p.date, healthy: h, surgical: p.e1rm, lsi: (p.e1rm / h) * 100 });
    }
    if (points.length === 0) continue;
    points.sort((a, b) => a.day - b.day);
    out.push({ key: g.key, rawName: g.rawName, location: g.location, points, currentLSI: points[points.length - 1].lsi });
  }
  return out;
}

// ---- bundle -----------------------------------------------------------------

export interface LiftAnalysis {
  strength: StrengthSeries[];
  summary: StrengthSummary;
  volume: MuscleVolume[];
  asymmetry: AsymmetrySeries[];
}

/** One-call analysis bundle for the UI. */
export function analyzeLifts(sessions: LiftSession[], opts: AsymmetryOptions & VolumeOptions = {}): LiftAnalysis {
  return {
    strength: strengthSeries(sessions),
    summary: strengthSummary(sessions),
    volume: weeklyVolumeByMuscle(sessions, opts),
    asymmetry: limbAsymmetry(sessions, opts),
  };
}
