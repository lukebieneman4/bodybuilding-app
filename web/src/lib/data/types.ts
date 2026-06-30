/** Shared data types. Mass is stored canonically in kilograms (SI). */

export type Units = 'lb' | 'kg';

export interface WeighIn {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Body mass in kilograms (canonical). */
  weightKg: number;
}

export interface CalorieEntry {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Energy intake in kilocalories. */
  kcal: number;
  /** Protein intake in grams (optional — only when logged). */
  protein?: number;
}

/**
 * Feature preferences — every coaching layer is toggleable so the athlete can
 * hide what they don't want (e.g. progression cues if they progress by feel).
 * Defaults are on; merged with stored settings so new toggles appear enabled.
 */
export interface Settings {
  /** Per-lift progression coach (next-session load/rep targets, stall detection). */
  progressionCoach: boolean;
  /** Track protein intake (log field, target, adherence). */
  trackProtein: boolean;
  /** Whether the protein target scales off total bodyweight or fat-free mass. */
  proteinBasis: 'bodyweight' | 'leanmass';
  /** Protein target in grams per kg of the chosen basis (see protein.ts refs). */
  proteinTargetGPerKg: number;
  /** Body-fat %, for the lean-mass basis (optional; falls back to bodyweight). */
  bodyFatPct?: number;
  /** Deload / fatigue-management coaching. */
  deloadCoach: boolean;
  /** Cross-domain insights linking diet and training. */
  crossDomain: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  progressionCoach: true,
  trackProtein: true,
  proteinBasis: 'bodyweight',
  // 2.2 g/kg BW ≈ 1 g/lb — classic natural target; top of Morton 2018's CI and a
  // safe deficit level (Iraki 2019). Lean-mass basis uses a higher default — see protein.ts.
  proteinTargetGPerKg: 2.2,
  deloadCoach: true,
  crossDomain: true,
};

/** How the pace toward the goal is defined — the user picks exactly one. */
export type PaceMode = 'rate' | 'date' | 'duration';

export interface Profile {
  units: Units;
  /** Goal weight in kg (canonical). Single target — no range. */
  goalKg: number;
  /** Which pacing knob defines the phase. */
  paceMode: PaceMode;
  /** Target loss/gain rate, %bodyweight per week (positive = loss). Used when paceMode === 'rate'. */
  targetRatePctPerWeek: number;
  /** Hard deadline, ISO date. Used when paceMode === 'date'. */
  targetDate?: string;
  /** Phase length in weeks from the first weigh-in. Used when paceMode === 'duration'. */
  durationWeeks?: number;
  /** Free-text context (e.g. injury/recovery), shapes insights. */
  notes?: string;
  /** Optional — no longer collected in the form, kept for back-compat with stored profiles. */
  heightCm?: number;
  createdAt: string;
}

export const KG_PER_LB = 0.45359237;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const toKg = (w: number, units: Units): number => (units === 'lb' ? lbToKg(w) : w);
export const fromKg = (kg: number, units: Units): number => (units === 'lb' ? kgToLb(kg) : kg);
/** Convert a per-week rate in kg to display units. */
export const rateFromKg = (kgPerWk: number, units: Units): number =>
  units === 'lb' ? kgToLb(kgPerWk) : kgPerWk;
