/**
 * Parser for the "notes-style" bulk weight/calorie log: a start date plus one
 * line per consecutive day, e.g.
 *
 *   201.2 - 2400
 *   200.5 - 2400
 *   NA - NA        ← a skipped day still consumes a date slot
 *   199.3 - 2600
 *
 * Each line is `weight - calories`; either field may be NA / blank / a dash to
 * skip it. Weight is in the caller's display units (conversion happens at the
 * UI boundary). Kept pure and dependency-free so it can be unit-tested against
 * the exact format the user types.
 */

export interface BulkRow {
  /** ISO date this line maps to. */
  date: string;
  /** Parsed weight in display units, or null if skipped. */
  weight: number | null;
  /** Parsed calories, or null if skipped. */
  kcal: number | null;
  /** The original line text. */
  raw: string;
  /** True when the line had content but neither field could be read. */
  bad: boolean;
}

const SKIP_RE = /^(na|n\/a|-+|x|skip|\.)$/i;
/** Field separators: any dash/colon/comma/pipe/tab (with optional surrounding space). */
const SEP_RE = /\s*[-–—:,|\t]\s*/;

function isoPlus(start: string, days: number): string {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isBlankOrSkip(tok: string): boolean {
  const t = (tok ?? '').trim();
  return t === '' || SKIP_RE.test(t);
}

function parseNum(tok: string): number | null {
  if (isBlankOrSkip(tok)) return null;
  const v = Number(tok.trim().replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Parse the textarea contents into dated rows. Trailing blank lines are
 * dropped; interior blank/NA lines are kept so a missed day doesn't shift every
 * later date. The first line maps to `startDate`.
 */
export function parseBulkLog(text: string, startDate: string): BulkRow[] {
  const lines = text.replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.map((raw, i) => {
    const parts = raw.split(SEP_RE);
    const wTok = parts[0] ?? '';
    const kTok = parts[1] ?? '';
    const weight = parseNum(wTok);
    const kcal = parseNum(kTok);
    const bad = weight === null && kcal === null && !(isBlankOrSkip(wTok) && isBlankOrSkip(kTok));
    return { date: isoPlus(startDate, i), weight, kcal, raw, bad };
  });
}

/**
 * Serialize dated weigh-ins + calories back into the editable bulk-log format:
 * one line per consecutive day from the earliest to the latest entry, `weight -
 * calories`, with `NA` for a missing field. The inverse of {@link parseBulkLog}
 * (round-trips), so the paste box can also VIEW and EDIT existing data. Weights
 * are taken in display units already (conversion happens at the UI boundary).
 */
export function formatBulkLog(
  weighIns: { date: string; weight: number }[],
  calories: { date: string; kcal: number }[],
): { text: string; startDate: string } {
  const all = [...weighIns.map((w) => w.date), ...calories.map((c) => c.date)].sort();
  if (all.length === 0) return { text: '', startDate: '' };
  const start = all[0];
  const end = all[all.length - 1];
  const wMap = new Map(weighIns.map((w) => [w.date, w.weight]));
  const kMap = new Map(calories.map((c) => [c.date, c.kcal]));
  const lines: string[] = [];
  for (let d = start; d <= end; d = isoPlus(d, 1)) {
    const w = wMap.get(d);
    const k = kMap.get(d);
    lines.push(`${w != null ? (+w).toFixed(1) : 'NA'} - ${k != null ? Math.round(k) : 'NA'}`);
  }
  return { text: lines.join('\n'), startDate: start };
}

export interface BulkStats {
  weighIns: number;
  calorieDays: number;
  bad: number;
  from: string | null;
  to: string | null;
}

/** Summary counts for the live preview. */
export function summarize(rows: BulkRow[]): BulkStats {
  let weighIns = 0;
  let calorieDays = 0;
  let bad = 0;
  for (const r of rows) {
    if (r.weight !== null) weighIns++;
    if (r.kcal !== null) calorieDays++;
    if (r.bad) bad++;
  }
  const dated = rows.filter((r) => r.weight !== null || r.kcal !== null);
  return {
    weighIns,
    calorieDays,
    bad,
    from: dated[0]?.date ?? null,
    to: dated[dated.length - 1]?.date ?? null,
  };
}
