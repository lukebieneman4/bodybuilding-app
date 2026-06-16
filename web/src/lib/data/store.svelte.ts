import type { Profile, WeighIn, CalorieEntry } from './types';
import type { LiftSession } from '../lift/types';

/** Reactive, localStorage-backed app state (Svelte 5 runes). */

const KEY = 'bodybuilding.v1';

interface Persisted {
  profile: Profile | null;
  weighIns: WeighIn[];
  calories: CalorieEntry[];
  liftSessions: LiftSession[];
}

function load(): Persisted {
  const empty: Persisted = { profile: null, weighIns: [], calories: [], liftSessions: [] };
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
  setLiftSessions(sessions: LiftSession[]): void {
    data.liftSessions = [...sessions].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    persist();
  },
  clearLifts(): void {
    data.liftSessions = [];
    persist();
  },
  importWeighIns(list: WeighIn[]): void {
    for (const w of list) upsertByDate(data.weighIns, w);
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
