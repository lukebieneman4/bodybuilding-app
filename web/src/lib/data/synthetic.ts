import type { WeighIn, CalorieEntry } from './types';

/** Deterministic synthetic diet-phase data for testing the estimators. */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function isoPlus(start: string, days: number): string {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const KCAL_PER_KG = 7700; // ~energy per kg body mass change (rule of thumb)

export interface SyntheticOptions {
  startKg?: number;
  goalKg?: number;
  days?: number;
  ratePctPerWeek?: number;
  maintenanceKcal?: number;
  startDate?: string;
  seed?: number;
  /** Peak of the mid-cut water-retention plateau, kg (0 disables it). */
  bumpKg?: number;
}

export interface SyntheticData {
  weighIns: WeighIn[];
  calories: CalorieEntry[];
}

/**
 * Generate a realistic diet phase: decelerating fat loss toward goal + a
 * mid-cut water plateau, with AR(1) water-weight noise, iid scale noise, and
 * ~25% skipped days. Intake is maintenance minus the deficit that produces the
 * loss, plus day-to-day variance — coherent enough to test adaptive TDEE.
 */
export function generateSynthetic(opts: SyntheticOptions = {}): SyntheticData {
  const startKg = opts.startKg ?? 90;
  const goalKg = opts.goalKg ?? 80;
  const N = opts.days ?? 84;
  const ratePct = opts.ratePctPerWeek ?? 0.6;
  const maintenance = opts.maintenanceKcal ?? 2900;
  const startDate = opts.startDate ?? isoPlus(new Date().toISOString().slice(0, 10), -N + 1);
  const bumpKg = opts.bumpKg ?? 0.9;
  const rng = mulberry32(opts.seed ?? 1);

  const asym = goalKg - 0.3;
  // decelerating exponential whose initial weekly rate ≈ ratePct of start
  const initialDaily = ((ratePct / 100) * startKg) / 7;
  const k = initialDaily / (startKg - asym);

  const weighIns: WeighIn[] = [];
  const calories: CalorieEntry[] = [];
  let water = 0;
  for (let t = 0; t < N; t++) {
    const base = asym + (startKg - asym) * Math.exp(-k * t);
    const bump = bumpKg * Math.exp(-((t - Math.floor(N * 0.4)) ** 2) / (2 * 9 * 9));
    const latent = base + bump;
    water = 0.6 * water + gaussian(rng) * 0.55;
    const obs = latent + water + gaussian(rng) * 0.4;
    const date = isoPlus(startDate, t);
    if (t === 0 || rng() < 0.75) weighIns.push({ date, weightKg: obs });
    // Intake reflects ENERGY balance only. The deficit tracks the energy-driven
    // fat-loss rate (analytic |d(base)/dt|), NOT the latent weight: the mid-cut
    // water bump and AR(1) water are body-water/scale phenomena, not calories, so
    // they must not leak into modeled intake (else an adaptive-TDEE estimator
    // would learn to attribute water swings to energy). KCAL_PER_KG ≈ adipose
    // energy density (Hall 2008). Estimator must recover maintenance from the
    // de-noised trend rate, not raw weight diffs (MacroFactor-style).
    const dailyLossKg = (startKg - asym) * k * Math.exp(-k * t); // kg/day, ≥0 for a cut
    const deficit = dailyLossKg * KCAL_PER_KG;
    const kcal = Math.round(maintenance - deficit + gaussian(rng) * 180);
    if (rng() < 0.85) calories.push({ date, kcal });
  }
  return { weighIns, calories };
}
