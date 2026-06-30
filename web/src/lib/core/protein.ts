/**
 * Daily protein target — the dominant nutrition lever for a natural athlete.
 *
 * Evidence (current literature, cite the source — CLAUDE.md):
 *  • Total-bodyweight basis: ~1.6 g/kg/day is the meta-analytic breakpoint for
 *    maximal muscle gain, with the confidence interval reaching ~2.2 g/kg
 *    (Morton et al. 2018, Br J Sports Med). Off-season natural bodybuilding:
 *    1.6–2.2 g/kg (Iraki et al. 2019). Default 2.2 ≈ 1 g/lb, a safe upper end.
 *  • Fat-free-mass basis (more accurate, especially in a deficit, since protein
 *    need tracks lean tissue not fat): 2.3–3.1 g/kg FFM (Helms et al. 2014).
 *    Default 2.6 sits mid-range.
 * These are coach-consensus targets, not hard constants — adjustable in settings.
 */

import type { Settings } from '../data/types';

/** Recommended g/kg ranges + citation per basis (for UI guidance). */
export const PROTEIN_GUIDANCE = {
  bodyweight: { lo: 1.6, hi: 2.2, cite: 'Morton 2018 meta; Iraki 2019' },
  leanmass: { lo: 2.3, hi: 3.1, cite: 'Helms 2014, per fat-free mass' },
} as const;

/** Sensible default g/kg for each basis. */
export const PROTEIN_DEFAULT_G_PER_KG: Record<Settings['proteinBasis'], number> = {
  bodyweight: 2.2,
  leanmass: 2.6,
};

/** Fat-free mass (kg) from bodyweight + body-fat %, or null if bf% is unusable. */
export function leanMassKg(bodyweightKg: number, bodyFatPct?: number): number | null {
  if (bodyFatPct == null || bodyFatPct <= 0 || bodyFatPct >= 100) return null;
  return bodyweightKg * (1 - bodyFatPct / 100);
}

/**
 * Daily protein target in grams. Uses fat-free mass when the user chose the
 * lean-mass basis AND gave a usable body-fat % (Helms 2014); otherwise scales off
 * total bodyweight (Morton 2018). Returns 0 when bodyweight is unknown.
 */
export function proteinTargetGrams(settings: Settings, bodyweightKg: number): number {
  if (!bodyweightKg || bodyweightKg <= 0) return 0;
  const ffm = leanMassKg(bodyweightKg, settings.bodyFatPct);
  const base = settings.proteinBasis === 'leanmass' && ffm != null ? ffm : bodyweightKg;
  return settings.proteinTargetGPerKg * base;
}
