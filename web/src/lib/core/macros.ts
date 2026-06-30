/**
 * Macro targets for a natural athlete. Two modes:
 *   • 'auto'   — science-based split: protein set first (protein.ts), fat set by
 *                g/kg bodyweight but never below a hormonal floor, carbs fill the
 *                rest of the calorie target.
 *   • 'custom' — the athlete's own explicit gram targets, returned as-is.
 *
 * Evidence (cite the source — CLAUDE.md):
 *   • Fat: 0.5–1.5 g/kg bodyweight, and ≥~20% of calories — going much lower can
 *     suppress testosterone in natural lifters (Iraki et al. 2019; Whittaker &
 *     Wu 2021 meta). Default 0.8 g/kg, floored at 20% of the calorie target.
 *   • Carbs: fill the remaining energy after protein and fat — they fuel training
 *     and recovery, so "as many as the calorie budget allows" (Iraki et al. 2019).
 */

import type { Settings } from '../data/types';
import { proteinTargetGrams } from './protein';

export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;
/** Minimum fat as a fraction of calories — hormonal floor (Iraki 2019; Whittaker 2021). */
export const FAT_KCAL_FLOOR_FRAC = 0.2;
/** Recommended fat g/kg bodyweight range, for UI guidance. */
export const FAT_GUIDANCE = { lo: 0.5, hi: 1.5, cite: 'Iraki 2019; Whittaker 2021 (≥20% kcal)' };

export interface MacroTargets {
  /** Calorie total the macros sum to. */
  calories: number;
  protein: number;
  fat: number;
  /** Carb grams (remainder); null when there's no calorie target to take it from. */
  carb: number | null;
  source: 'auto' | 'custom';
  /** Fat was raised to the hormonal floor. */
  fatFloored: boolean;
  /** Protein + fat already met/exceeded the calorie target, so carbs clipped to 0. */
  clipped: boolean;
}

/**
 * Daily macro targets. `calorieTarget` is the goal-driven energy budget
 * (maintenance ± for the planned rate); pass 0/unknown to get protein+fat only
 * (no carb remainder).
 */
export function macroTargets(settings: Settings, bodyweightKg: number, calorieTarget: number): MacroTargets {
  if (settings.macroMode === 'custom') {
    const protein = settings.customProteinG ?? 0;
    const fat = settings.customFatG ?? 0;
    const carb = settings.customCarbG ?? 0;
    const calories = protein * KCAL_PER_G.protein + carb * KCAL_PER_G.carb + fat * KCAL_PER_G.fat;
    return { calories, protein, fat, carb, source: 'custom', fatFloored: false, clipped: false };
  }

  const protein = proteinTargetGrams(settings, bodyweightKg);
  let fat = settings.fatTargetGPerKg * bodyweightKg;
  let fatFloored = false;

  if (calorieTarget <= 0) {
    return { calories: protein * 4 + fat * 9, protein, fat, carb: null, source: 'auto', fatFloored, clipped: false };
  }

  const floorG = (FAT_KCAL_FLOOR_FRAC * calorieTarget) / KCAL_PER_G.fat;
  if (fat < floorG) {
    fat = floorG;
    fatFloored = true;
  }
  const remaining = calorieTarget - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat;
  const carb = Math.max(0, remaining / KCAL_PER_G.carb);
  return { calories: calorieTarget, protein, fat, carb, source: 'auto', fatFloored, clipped: remaining < 0 };
}
