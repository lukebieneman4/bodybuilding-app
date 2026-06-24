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
}

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
