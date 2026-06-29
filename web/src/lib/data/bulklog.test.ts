import { describe, it, expect } from 'vitest';
import { parseBulkLog, summarize, formatBulkLog } from './bulklog';

describe('parseBulkLog', () => {
  it("parses the user's notes-style example", () => {
    const text = ['201.2 - 2400', '200.5 - 2400', '200.1 - 2200', 'NA - NA', '199.3 - 2600'].join(
      '\n'
    );
    const rows = parseBulkLog(text, '2026-06-27');
    expect(rows.map((r) => r.date)).toEqual([
      '2026-06-27',
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ]);
    expect(rows.map((r) => r.weight)).toEqual([201.2, 200.5, 200.1, null, 199.3]);
    expect(rows.map((r) => r.kcal)).toEqual([2400, 2400, 2200, null, 2600]);
    expect(rows.some((r) => r.bad)).toBe(false);
  });

  it('keeps dates aligned across a skipped (NA) day', () => {
    const rows = parseBulkLog('201.2 - 2400\nNA - NA\n199.3 - 2600', '2026-06-27');
    // the third line must still land on the third day, not the second
    expect(rows[2].date).toBe('2026-06-29');
    expect(rows[2].weight).toBe(199.3);
  });

  it('accepts weight-only lines and a missing calorie field', () => {
    const rows = parseBulkLog('201.2\n200.5 - 2400\n200.1 -', '2026-06-27');
    expect(rows.map((r) => r.weight)).toEqual([201.2, 200.5, 200.1]);
    expect(rows.map((r) => r.kcal)).toEqual([null, 2400, null]);
    expect(rows.some((r) => r.bad)).toBe(false);
  });

  it('flags genuinely unreadable lines but not skip markers', () => {
    const rows = parseBulkLog('hello world\nNA\n-\n200.1 - 2200', '2026-06-27');
    expect(rows[0].bad).toBe(true); // "hello world" — no number
    expect(rows[1].bad).toBe(false); // NA
    expect(rows[2].bad).toBe(false); // -
    expect(rows[3].bad).toBe(false);
  });

  it('drops trailing blank lines but keeps interior ones as skipped days', () => {
    const rows = parseBulkLog('201.2 - 2400\n\n199.3 - 2600\n\n\n', '2026-06-27');
    expect(rows).toHaveLength(3); // trailing blanks dropped
    expect(rows[1].weight).toBeNull(); // interior blank = skipped day
    expect(rows[2].date).toBe('2026-06-29'); // alignment preserved
  });

  it('round-trips through formatBulkLog (serialize → parse)', () => {
    const weighIns = [
      { date: '2026-06-27', weight: 201.2 },
      { date: '2026-06-29', weight: 199.3 }, // gap on the 28th
    ];
    const calories = [
      { date: '2026-06-27', kcal: 2400 },
      { date: '2026-06-28', kcal: 2200 }, // calorie-only day
    ];
    const { text, startDate } = formatBulkLog(weighIns, calories);
    expect(startDate).toBe('2026-06-27');
    expect(text).toBe(['201.2 - 2400', 'NA - 2200', '199.3 - NA'].join('\n'));

    const rows = parseBulkLog(text, startDate);
    expect(rows.map((r) => r.weight)).toEqual([201.2, null, 199.3]);
    expect(rows.map((r) => r.kcal)).toEqual([2400, 2200, null]);
    expect(rows.map((r) => r.date)).toEqual(['2026-06-27', '2026-06-28', '2026-06-29']);
  });

  it('formatBulkLog returns empty for no data', () => {
    expect(formatBulkLog([], [])).toEqual({ text: '', startDate: '' });
  });

  it('summarizes counts and date range', () => {
    const rows = parseBulkLog('201.2 - 2400\nNA - NA\n199.3 - 2600', '2026-06-27');
    const s = summarize(rows);
    expect(s.weighIns).toBe(2);
    expect(s.calorieDays).toBe(2);
    expect(s.bad).toBe(0);
    expect(s.from).toBe('2026-06-27');
    expect(s.to).toBe('2026-06-29');
  });
});
