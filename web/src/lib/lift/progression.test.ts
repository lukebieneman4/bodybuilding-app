import { describe, it, expect } from 'vitest';
import { progressionCue } from './progression';
import { strengthSeries } from './analysis';
import { parseExerciseLine } from './parser';
import type { LiftSession } from './types';

const session = (date: string, lines: string[]): LiftSession => ({
  title: 't',
  split: null,
  location: 'Gym',
  exercises: lines.map((l) => parseExerciseLine(l)!),
  date,
});

const cueFor = (sessions: LiftSession[]) => progressionCue(strengthSeries(sessions)[0]);

describe('progressionCue', () => {
  it('tells you to beat last session when progressing near failure', () => {
    const s = [
      session('2026-01-01', ['Machine Chest Press 180- 10.1']),
      session('2026-01-03', ['Machine Chest Press 185- 10.1']),
      session('2026-01-05', ['Machine Chest Press 190- 10.1']),
    ];
    const cue = cueFor(s)!;
    expect(cue.kind).toBe('overload');
    expect(cue.headline).toContain('190'); // last load
    expect(cue.headline).toContain('10'); // last reps
  });

  it('flags too much in reserve as an intensity cue', () => {
    const s = [
      session('2026-01-01', ['Pec Deck 300- 10.5']), // RIR 5
      session('2026-01-03', ['Pec Deck 300- 10.5']),
    ];
    const cue = cueFor(s)!;
    expect(cue.kind).toBe('intensity');
  });

  it('detects a stall when the smoothed trend is flat over several sessions', () => {
    const flat = Array.from({ length: 5 }, (_, i) =>
      session(`2026-01-0${i + 1}`, ['Uni Leg Ext 200- 10.1'])
    );
    const cue = cueFor(flat)!;
    expect(cue.kind).toBe('stall');
  });

  it('returns null without enough comparable history', () => {
    const one = [session('2026-01-01', ['Pec Deck 300- 10.1'])];
    expect(cueFor(one)).toBeNull();
  });

  it('returns null for a mixed relative/absolute load series', () => {
    const s = [
      session('2026-01-01', ['Pec Deck 300- 10.1']),
      session('2026-01-03', ['Pec Deck +25- 10.1']), // over-stack, not comparable
    ];
    expect(cueFor(s)).toBeNull();
  });
});
