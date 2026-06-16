import { describe, it, expect } from 'vitest';
import { estimateE1RM, isHardSet } from './e1rm';
import type { LiftSet } from './types';

/** Build a minimal set for testing. */
const S = (load: number, reps: number, rir: number | null, failure = false): LiftSet => ({
  reps,
  rir,
  failure,
  load: { value: load, raw: String(load), relative: false },
  limb: null,
});

describe('estimateE1RM (Epley, SCIENCE.md §1)', () => {
  it('matches the Epley value at RIR 0', () => {
    // 200 × (1 + 10/30) = 266.67
    const e = estimateE1RM(S(200, 10, 0))!;
    expect(e.value).toBeCloseTo(266.67, 1);
    expect(e.repsToFailure).toBe(10);
    expect(e.confidence).toBe('high');
  });

  it('treats `.f` (failure) as RIR 0, high-confidence', () => {
    const e = estimateE1RM(S(140, 8, null, true))!;
    expect(e.value).toBeCloseTo(177.33, 1);
    expect(e.confidence).toBe('high');
  });

  it('adds RIR into reps-to-failure and flags >10 reps low-confidence', () => {
    // reps 12 @ RIR 2 → reps_to_failure 14 → 225 × (1 + 14/30) = 330
    const e = estimateE1RM(S(225, 12, 2))!;
    expect(e.value).toBeCloseTo(330, 0);
    expect(e.confidence).toBe('low');
  });

  it('emits no e1RM above the validity ceiling (15 reps-to-failure)', () => {
    expect(estimateE1RM(S(100, 14, 2))).toBeNull(); // 16 > 15
  });

  it('returns null for non-estimable sets (no load, no reps)', () => {
    expect(estimateE1RM(S(0, 8, 0))).toBeNull();
    expect(estimateE1RM(S(200, 0, 0))).toBeNull();
  });

  it('estimates with unlogged RIR but marks it low-confidence', () => {
    const e = estimateE1RM(S(100, 8, null))!;
    expect(e.repsToFailure).toBe(8);
    expect(e.confidence).toBe('low');
  });
});

describe('isHardSet (RIR ≤ 3, SCIENCE.md §2)', () => {
  it('counts sets within 3 RIR of failure', () => {
    expect(isHardSet(S(200, 10, 0))).toBe(true);
    expect(isHardSet(S(200, 10, 3))).toBe(true);
    expect(isHardSet(S(200, 10, null, true))).toBe(true); // failure
  });
  it('excludes easy sets and skipped (zero-rep) sets', () => {
    expect(isHardSet(S(200, 10, 4))).toBe(false);
    expect(isHardSet(S(200, 0, 0))).toBe(false); // surgical side skipped
  });
  it('counts a set with unlogged RIR (user trains near failure)', () => {
    expect(isHardSet(S(80, 6, null))).toBe(true);
  });
});
