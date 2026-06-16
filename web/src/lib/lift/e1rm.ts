/**
 * e1RM (estimated one-rep max) as a WITHIN-EXERCISE progression index, and the
 * "hard set" classifier. See SCIENCE.md §1–2 for the cited rationale.
 *
 * Loads are machine-stack units (self-relative), so this is NOT an absolute 1RM
 * and must never be compared across exercises/machines — it's an ordinal index
 * whose *trend* over time is the trustworthy signal.
 */

import type { LiftSet } from './types';

/** Epley: e1RM = load × (1 + reps_to_failure / 30). Accurate ~1–10 reps. (SCIENCE.md §1) */
export const EPLEY_DIVISOR = 30;
/** Reps-to-failure at/below which the e1RM is high-confidence. (SCIENCE.md §1) */
export const E1RM_HIGH_CONF_REPS = 10;
/** Above this reps-to-failure, prediction error is too large — emit no e1RM. (SCIENCE.md §1) */
export const E1RM_REP_CEILING = 15;
/** A set counts toward weekly volume if taken to within this many RIR of failure. (SCIENCE.md §2) */
export const HARD_SET_RIR_MAX = 3;

export type Confidence = 'high' | 'low';

export interface E1RM {
  /** Estimated top-set load in this exercise's stack units. */
  value: number;
  /** Estimated reps-to-failure used (reps + RIR; failure = RIR 0). */
  repsToFailure: number;
  confidence: Confidence;
}

/** Effective RIR: `.f` (failure) → 0; otherwise the logged RIR (may be null). */
export function effectiveRIR(set: LiftSet): number | null {
  return set.failure ? 0 : set.rir;
}

/**
 * Estimate e1RM for one set, or null when it can't be honestly estimated
 * (no load, no reps, or reps-to-failure beyond the validity ceiling).
 * When RIR is unlogged we assume the set was taken near failure (this user
 * trains 0–2 RIR) but mark it low-confidence.
 */
export function estimateE1RM(set: LiftSet): E1RM | null {
  if (set.load.value <= 0 || set.reps <= 0) return null;
  const rir = effectiveRIR(set);
  const rtf = set.reps + (rir ?? 0);
  if (rtf > E1RM_REP_CEILING) return null;
  const value = set.load.value * (1 + rtf / EPLEY_DIVISOR);
  const rirKnown = set.failure || set.rir != null;
  const confidence: Confidence = rirKnown && rtf <= E1RM_HIGH_CONF_REPS ? 'high' : 'low';
  return { value, repsToFailure: rtf, confidence };
}

/**
 * Does this set count as one effective ("hard") set toward weekly volume?
 * Requires real reps and a proximity within HARD_SET_RIR_MAX of failure.
 * Load is NOT required: a surgical-side bodyweight set (load 0, reps > 0) is
 * still stimulating volume; only zero-rep (skipped) sets are excluded.
 */
export function isHardSet(set: LiftSet): boolean {
  if (set.reps <= 0) return false;
  const rir = effectiveRIR(set);
  if (rir == null) return true; // RIR unlogged — assume stimulating (trains near failure)
  return rir <= HARD_SET_RIR_MAX;
}
