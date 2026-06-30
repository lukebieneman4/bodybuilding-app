/**
 * Priority muscle groups — which muscles the athlete is emphasizing this block.
 * A priority muscle's coaching to-dos surface first, so the most important gap
 * (e.g. a priority that's below MEV) is what you see at the top of the coach.
 *
 * Two sources, in order of precedence:
 *   1. a manual list the user pins (via presets or hand-picked muscles), or
 *   2. auto-detection from how the log is PROGRAMMED — lifts placed earlier in a
 *      session are trained when freshest, the classic way to prioritize a muscle.
 */

import type { LiftSession } from './types';
import { musclesFor, LANDMARKS, type Muscle } from './muscles';

/** Muscles a user can pick as priorities (those the coach has landmarks for). */
export const SELECTABLE_MUSCLES: Muscle[] = (Object.keys(LANDMARKS) as Muscle[]).filter((m) => LANDMARKS[m]);

/** Quick priority presets (a focus → its muscles). */
export const PRIORITY_PRESETS: { label: string; muscles: Muscle[] }[] = [
  { label: 'Chest & Back', muscles: ['chest', 'lats', 'traps'] },
  { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Arms & Delts', muscles: ['biceps', 'triceps', 'side_delt', 'rear_delt'] },
  { label: 'Shoulders', muscles: ['side_delt', 'rear_delt', 'front_delt'] },
];

/** Keep only valid, de-duplicated selectable muscles (e.g. from persisted state). */
export function sanitizePriorities(list: readonly string[]): Muscle[] {
  const ok = new Set<string>(SELECTABLE_MUSCLES);
  const seen = new Set<string>();
  const out: Muscle[] = [];
  for (const m of list) if (ok.has(m) && !seen.has(m)) (seen.add(m), out.push(m as Muscle));
  return out;
}

/**
 * Auto-detect priority muscles from program order. For each session the first
 * third of exercises are "priority slots"; a muscle's score is the share of its
 * appearances (as a primary mover) that land in those slots. Muscles trained
 * early in most of their sessions (score ≥ 0.5) are priorities, ranked by score
 * then earliest average position. Looks at the recent window for relevance.
 */
export function autoPriorities(sessions: LiftSession[], opts: { windowSessions?: number } = {}): Muscle[] {
  const dated = sessions.filter((s) => s.exercises.length > 0);
  const recent = opts.windowSessions ? dated.slice(-opts.windowSessions) : dated;
  if (recent.length === 0) return [];

  const agg = new Map<Muscle, { appears: number; early: number; posSum: number }>();
  for (const s of recent) {
    const n = s.exercises.length;
    const slots = Math.max(1, Math.ceil(n / 3));
    s.exercises.forEach((ex, i) => {
      const att = musclesFor(ex.key);
      if (!att) return;
      const pos = n > 1 ? i / (n - 1) : 0; // 0 = first, 1 = last
      for (const m of att.primary) {
        const a = agg.get(m) ?? { appears: 0, early: 0, posSum: 0 };
        a.appears += 1;
        a.early += i < slots ? 1 : 0;
        a.posSum += pos;
        agg.set(m, a);
      }
    });
  }

  return [...agg.entries()]
    .map(([muscle, a]) => ({ muscle, score: a.early / a.appears, avgPos: a.posSum / a.appears }))
    .filter((x) => x.score >= 0.5 && LANDMARKS[x.muscle])
    .sort((a, b) => b.score - a.score || a.avgPos - b.avgPos)
    .map((x) => x.muscle);
}

/** Active priority list: the user's manual pick if set, else auto-detected. */
export function resolvePriorities(
  sessions: LiftSession[],
  manual: readonly string[] | null,
  opts: { windowSessions?: number } = {}
): Muscle[] {
  const pinned = manual ? sanitizePriorities(manual) : [];
  return pinned.length ? pinned : autoPriorities(sessions, opts);
}
