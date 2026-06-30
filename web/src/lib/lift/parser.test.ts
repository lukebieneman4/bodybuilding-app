import { describe, it, expect } from 'vitest';
import { parseTitle, parseExerciseLine, parseWorkoutLog, lineDiagnostics } from './parser';
import type { LiftSet } from './types';

/** Compact view of a set for readable assertions: [limb, load, reps, rir, failure]. */
const sig = (s: LiftSet): [string | null, number, number, number | null, boolean] => [
  s.limb,
  s.load.value,
  s.reps,
  s.rir,
  s.failure,
];

describe('parseTitle', () => {
  it('splits the session type from the gym/location suffix', () => {
    expect(parseTitle('Anterior Brick:')).toEqual({ title: 'Anterior Brick', split: 'Anterior', location: 'Brick' });
    expect(parseTitle('Posterior Ash:')).toEqual({ title: 'Posterior Ash', split: 'Posterior', location: 'Ash' });
    expect(parseTitle('FBEOD:')).toEqual({ title: 'FBEOD', split: 'FBEOD', location: null });
    expect(parseTitle('Posterior:')).toEqual({ title: 'Posterior', split: 'Posterior', location: null });
  });
});

describe('parseExerciseLine — basics', () => {
  it('reads name, setup, load, and a single set', () => {
    const ex = parseExerciseLine('Uni Machine Side Delt (5) 170- 10.0')!;
    expect(ex.rawName).toBe('Uni Machine Side Delt');
    expect(ex.setup).toEqual(['5']);
    expect(ex.modifiers).toEqual(['uni', 'machine']);
    expect(ex.flagged).toBe(false);
    expect(ex.sets.map(sig)).toEqual([[null, 170, 10, 0, false]]);
  });

  it('treats `.f` as failure with RIR unlogged', () => {
    const ex = parseExerciseLine('Machine Side Delt (5) 140- 8.f')!;
    expect(ex.sets.map(sig)).toEqual([[null, 140, 8, null, true]]);
  });

  it('captures `+N` as a relative (over-stack) load', () => {
    const ex = parseExerciseLine('Uni Pec Deck (5, 4, 2) +25- 10.0')!;
    expect(ex.setup).toEqual(['5', '4', '2']);
    expect(ex.sets[0].load).toEqual({ value: 25, raw: '+25', relative: true });
    expect(ex.sets.map(sig)).toEqual([[null, 25, 10, 0, false]]);
  });
});

describe('parseExerciseLine — left/right limb splits', () => {
  it('splits load and reps per limb across multiple sets (and repairs "10 .0")', () => {
    const ex = parseExerciseLine('Uni Leg Press 225/90- 12.2/10.1, 12.0/10 .0')!;
    expect(ex.flagged).toBe(false);
    expect(ex.sets.map(sig)).toEqual([
      ['L', 225, 12, 2, false],
      ['R', 90, 10, 1, false],
      ['L', 225, 12, 0, false],
      ['R', 90, 10, 0, false],
    ]);
  });

  it('applies a single load to both limbs when only the reps are split', () => {
    const ex = parseExerciseLine('Uni Machine cable Kickback 80/0- 10.0/0')!;
    expect(ex.sets.map(sig)).toEqual([
      ['L', 80, 10, 0, false],
      ['R', 0, 0, null, false], // surgical side: zero load, zero reps
    ]);
  });

  it('handles decimal per-limb loads (cable kickback 32.5/17.5)', () => {
    const ex = parseExerciseLine('Uni Cable Kickback (21) 32.5/17.5- 8.1/11.2, 8.0/11.1')!;
    expect(ex.rawName).toBe('Uni Cable Kickback');
    expect(ex.setup).toEqual(['21']);
    expect(ex.flagged).toBe(false);
    expect(ex.sets.map(sig)).toEqual([
      ['L', 32.5, 8, 1, false],
      ['R', 17.5, 11, 2, false],
      ['L', 32.5, 8, 0, false],
      ['R', 17.5, 11, 1, false],
    ]);
  });

  it('keeps a name that contains a number (45° ext) out of the load', () => {
    const ex = parseExerciseLine('Uni 45 Ext 100/0- 7.0/8.0')!;
    expect(ex.rawName).toBe('Uni 45 Ext');
    expect(ex.key).toContain('45');
    expect(ex.sets.map(sig)).toEqual([
      ['L', 100, 7, 0, false],
      ['R', 0, 8, 0, false],
    ]);
  });
});

describe('parseExerciseLine — multiple load blocks (back-off / second load)', () => {
  it('starts a new block when a `/` introduces a fresh load-dash', () => {
    const ex = parseExerciseLine('Wide Grip Pulldown 220- 10.1/ 240- 7.0')!;
    expect(ex.sets.map(sig)).toEqual([
      [null, 220, 10, 1, false],
      [null, 240, 7, 0, false],
    ]);
  });

  it('handles per-limb splits AND a second block on one line', () => {
    const ex = parseExerciseLine('Machine Calf Press 376/70- 10.0/20.2/ 376/104- 9.0/13.0')!;
    expect(ex.sets.map(sig)).toEqual([
      ['L', 376, 10, 0, false],
      ['R', 70, 20, 2, false],
      ['L', 376, 9, 0, false],
      ['R', 104, 13, 0, false],
    ]);
  });
});

describe('parseExerciseLine — floating setup / stray dashes', () => {
  it('accepts setup after the weight', () => {
    const ex = parseExerciseLine('Machine Chest Press 180 (2, 0)- 10.1, 10.0')!;
    expect(ex.rawName).toBe('Machine Chest Press');
    expect(ex.setup).toEqual(['2', '0']);
    expect(ex.sets.map(sig)).toEqual([
      [null, 180, 10, 1, false],
      [null, 180, 10, 0, false],
    ]);
  });

  it('collapses a stray double dash from a mid-line setup', () => {
    const ex = parseExerciseLine('Reverse Pec Deck 220- (5, 1)- 7.0, 6.0')!;
    expect(ex.setup).toEqual(['5', '1']);
    expect(ex.sets.map(sig)).toEqual([
      [null, 220, 7, 0, false],
      [null, 220, 6, 0, false],
    ]);
  });
});

describe('parseWorkoutLog — whole paste', () => {
  it('groups exercises under sessions and quarantines junk lines', () => {
    const text = [
      'Anterior Brick:',
      'Uni Machine Side Delt (5) 170- 10.0',
      'Pec Deck (5, 1) 308- 11.0',
      'Posterior Ash:',
      'Reverse Pec Deck (5, 1) 248- 7.0, 6.0',
      'Descriptive and analytic MBSE nonsense', // trailing junk, no load
    ].join('\n');
    const { sessions, unparsed } = parseWorkoutLog(text);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].title).toBe('Anterior Brick');
    expect(sessions[0].location).toBe('Brick');
    expect(sessions[0].exercises).toHaveLength(2);
    expect(sessions[1].split).toBe('Posterior');
    expect(sessions[1].exercises).toHaveLength(1);
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0].text).toContain('MBSE');
  });
});

describe('lineDiagnostics — per-line underline data', () => {
  it('reports 0-based line indices for skipped and flagged lines, skipping titles/blanks', () => {
    const text = [
      'Anterior Brick:', // 0 title — skipped from diagnostics
      'Pec Deck (5) 308- 11.0', // 1 clean
      '', // 2 blank
      'Descriptive MBSE nonsense', // 3 not an exercise → skipped
      'Uni Side Delt 170- ?bad', // 4 has load+dash but junk tail → flagged
    ].join('\n');
    const diag = lineDiagnostics(text);
    const byLine = new Map(diag.map((d) => [d.line, d.kind]));
    expect(byLine.get(0)).toBeUndefined();
    expect(byLine.get(1)).toBeUndefined();
    expect(byLine.get(2)).toBeUndefined();
    expect(byLine.get(3)).toBe('skipped');
    expect(byLine.get(4)).toBe('flagged');
  });

  it('returns nothing for a clean log', () => {
    const text = ['Push:', 'Bench 225- 5.2', 'Pec Deck 300- 10.1'].join('\n');
    expect(lineDiagnostics(text)).toHaveLength(0);
  });
});
