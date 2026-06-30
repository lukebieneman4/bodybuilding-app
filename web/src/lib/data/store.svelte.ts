import type { Profile, WeighIn, CalorieEntry } from './types';
import type { LiftSession } from '../lift/types';

/** Reactive, localStorage-backed app state (Svelte 5 runes). */

const KEY = 'bodybuilding.v1';

interface Persisted {
  profile: Profile | null;
  weighIns: WeighIn[];
  calories: CalorieEntry[];
  liftSessions: LiftSession[];
  /** Raw pasted training log — the editable source of truth; sessions are derived from it. */
  liftLog: string;
  /** Anchor date for the most recent session (ISO) when (re)deriving sessions from liftLog. */
  liftLogEndDate: string;
  /** User-declared training density (sessions/week); null = auto-derive from the log. */
  liftSessionsPerWeek: number | null;
  /** Manually pinned priority muscles; null/empty = auto-detect from program order. */
  liftPriorities: string[] | null;
}

function load(): Persisted {
  const empty: Persisted = { profile: null, weighIns: [], calories: [], liftSessions: [], liftLog: '', liftLogEndDate: '', liftSessionsPerWeek: null, liftPriorities: null };
  if (typeof localStorage === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

const data = $state<Persisted>(load());

function persist(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(data));
}

function upsertByDate<T extends { date: string }>(arr: T[], item: T): void {
  const i = arr.findIndex((x) => x.date === item.date);
  if (i >= 0) arr[i] = item;
  else arr.push(item);
  arr.sort((a, b) => a.date.localeCompare(b.date));
}

export const store = {
  get profile(): Profile | null {
    return data.profile;
  },
  get weighIns(): WeighIn[] {
    return data.weighIns;
  },
  get calories(): CalorieEntry[] {
    return data.calories;
  },
  setProfile(p: Profile): void {
    data.profile = p;
    persist();
  },
  addWeighIn(w: WeighIn): void {
    upsertByDate(data.weighIns, w);
    persist();
  },
  addCalorie(c: CalorieEntry): void {
    upsertByDate(data.calories, c);
    persist();
  },
  get liftSessions(): LiftSession[] {
    return data.liftSessions;
  },
  get liftLog(): string {
    return data.liftLog;
  },
  get liftLogEndDate(): string {
    return data.liftLogEndDate;
  },
  get liftSessionsPerWeek(): number | null {
    return data.liftSessionsPerWeek;
  },
  /** Set training density (sessions/week), or null to auto-derive from the log. */
  setLiftSessionsPerWeek(spw: number | null): void {
    data.liftSessionsPerWeek = spw;
    persist();
  },
  get liftPriorities(): string[] | null {
    return data.liftPriorities;
  },
  /** Pin priority muscles, or null/[] to auto-detect from program order. */
  setLiftPriorities(muscles: string[] | null): void {
    data.liftPriorities = muscles && muscles.length ? muscles : null;
    persist();
  },
  setLiftSessions(sessions: LiftSession[]): void {
    data.liftSessions = [...sessions].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    persist();
  },
  /** Save the raw log (source of truth) together with the resolved, dated sessions it produced. */
  setLiftLog(log: string, endDate: string, sessions: LiftSession[]): void {
    data.liftLog = log;
    data.liftLogEndDate = endDate;
    data.liftSessions = [...sessions].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    persist();
  },
  clearLifts(): void {
    data.liftSessions = [];
    data.liftLog = '';
    data.liftLogEndDate = '';
    data.liftSessionsPerWeek = null;
    data.liftPriorities = null;
    persist();
  },
  importWeighIns(list: WeighIn[]): void {
    for (const w of list) upsertByDate(data.weighIns, w);
    persist();
  },
  importCalories(list: CalorieEntry[]): void {
    for (const c of list) upsertByDate(data.calories, c);
    persist();
  },
  setData(weighIns: WeighIn[], calories: CalorieEntry[]): void {
    data.weighIns = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
    data.calories = [...calories].sort((a, b) => a.date.localeCompare(b.date));
    persist();
  },
  clearLogs(): void {
    data.weighIns = [];
    data.calories = [];
    persist();
  },
  reset(): void {
    data.profile = null;
    data.weighIns = [];
    data.calories = [];
    data.liftSessions = [];
    persist();
  },
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
