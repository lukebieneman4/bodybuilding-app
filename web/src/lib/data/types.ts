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

export interface Profile {
  heightCm: number;
  units: Units;
  /** Goal weight in kg (canonical). */
  goalKg: number;
  /** Optional goal range, kg. */
  goalLowKg?: number;
  goalHighKg?: number;
  /** Target loss/gain rate, %bodyweight per week (positive = loss). */
  targetRatePctPerWeek: number;
  /** Optional hard deadline, ISO date. */
  targetDate?: string;
  /** Current/maintenance intake estimate, kcal. */
  currentIntakeKcal?: number;
  /** Free-text context (e.g. injury/recovery), shapes insights. */
  notes?: string;
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
