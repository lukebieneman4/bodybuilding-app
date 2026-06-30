import { describe, it, expect } from 'vitest';
import { autoPriorities, resolvePriorities, sanitizePriorities } from './priority';
import { parseExerciseLine } from './parser';
import type { LiftSession } from './types';

const session = (lines: string[]): LiftSession => ({
  title: 't',
  split: null,
  location: null,
  exercises: lines.map((l) => parseExerciseLine(l)!),
  date: null,
});

// chest is programmed first every session; legs/arms come last
const chestFirst = [
  session(['Machine Chest Press 200- 8.0', 'Pec Deck 300- 8.0', 'Uni Leg Press 200/200- 8/8', 'Uni Leg Ext 200- 8.0', 'Uni Cable Tri Ext 30- 8.0']),
  session(['Machine Chest Press 205- 8.0', 'Pec Deck 305- 8.0', 'Uni Leg Press 205/205- 8/8', 'Uni Leg Ext 205- 8.0', 'Uni Cable Tri Ext 32- 8.0']),
];

describe('autoPriorities — detects what is programmed first', () => {
  it('ranks the muscle trained earliest as a priority, not the late ones', () => {
    const prio = autoPriorities(chestFirst);
    expect(prio[0]).toBe('chest'); // first two slots every session
    expect(prio).not.toContain('quads'); // mid/late
    expect(prio).not.toContain('triceps'); // last
  });

  it('returns nothing without sessions', () => {
    expect(autoPriorities([])).toEqual([]);
  });
});

describe('resolvePriorities — manual pin wins over auto', () => {
  it('uses the manual list when set', () => {
    expect(resolvePriorities(chestFirst, ['quads', 'hamstrings'])).toEqual(['quads', 'hamstrings']);
  });
  it('falls back to auto when manual is null or empty', () => {
    expect(resolvePriorities(chestFirst, null)[0]).toBe('chest');
    expect(resolvePriorities(chestFirst, [])[0]).toBe('chest');
  });
});

describe('sanitizePriorities — drops invalid / duplicate muscles', () => {
  it('keeps valid selectable muscles in order, de-duplicated', () => {
    expect(sanitizePriorities(['chest', 'bogus', 'chest', 'quads'])).toEqual(['chest', 'quads']);
  });
});
