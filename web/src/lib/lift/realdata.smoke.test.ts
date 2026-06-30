import { describe, it, expect } from 'vitest';
import { SAMPLE_LOG } from './sample';
import { parseWorkoutLog } from './parser';
import { assignCadenceDates } from './dates';
import { analyzeLifts } from './analysis';

/**
 * Real-data integration smoke: parse the user's actual `2026 Post ACL Training`
 * log (PDFKit-extracted to one-exercise-per-line, bundled in sample.ts) and run
 * the full analysis. Not a golden test — it asserts the pipeline holds together
 * on messy real input and prints a summary to eyeball.
 */
describe('real ACL training log — end to end', () => {
  it('parses and analyzes without losing data', () => {
    const { sessions, unparsed } = parseWorkoutLog(SAMPLE_LOG);
    const dated = assignCadenceDates(sessions, '2026-01-01');
    const { strength, volume, asymmetry } = analyzeLifts(dated, { surgicalSide: 'R' });

    const flagged = sessions.flatMap((s) => s.exercises).filter((e) => e.flagged);
    const totalExercises = sessions.reduce((n, s) => n + s.exercises.length, 0);

    /* eslint-disable no-console */
    console.log('\n===== REAL LOG SUMMARY =====');
    console.log(`sessions: ${sessions.length} | exercises: ${totalExercises} | flagged: ${flagged.length} | unparsed lines: ${unparsed.length}`);
    console.log('\n-- strength: biggest gainers (slope/wk) --');
    [...strength]
      .filter((s) => s.points.length >= 3)
      .sort((a, b) => b.slopePerWeek - a.slopePerWeek)
      .slice(0, 8)
      .forEach((s) =>
        console.log(`  ${s.rawName}${s.limb ? ' [' + s.limb + ']' : ''} @${s.location ?? '?'}: e1RM ${s.current.toFixed(0)} (${s.slopePerWeek >= 0 ? '+' : ''}${s.slopePerWeek.toFixed(1)}/wk, ${s.points.length} pts)`)
      );
    console.log('\n-- weekly volume per muscle (trailing 14d) --');
    volume.forEach((v) => console.log(`  ${v.muscle}: ${v.setsPerWeek.toFixed(1)} sets/wk [${v.status}]`));
    console.log('\n-- volume breakdown (where the numbers come from) --');
    ['lats', 'traps', 'quads', 'chest', 'side_delt'].forEach((m) => {
      const v = volume.find((x) => x.muscle === m);
      if (!v) return;
      console.log(`  ${m} = ${v.setsPerWeek.toFixed(1)}/wk:`);
      v.contributions.forEach((c) =>
        console.log(`     ${c.rawName}: ${c.hardSets}×${c.creditPerSet} (${c.role}) → ${c.setsPerWeek.toFixed(1)}/wk`)
      );
    });
    console.log('\n-- L/R asymmetry (LSI = surgical/healthy) --');
    [...asymmetry]
      .sort((a, b) => a.currentLSI - b.currentLSI)
      .forEach((a) => console.log(`  ${a.rawName} @${a.location ?? '?'}: LSI ${a.currentLSI.toFixed(0)}%`));
    console.log('============================\n');
    /* eslint-enable no-console */

    // sanity, not golden:
    expect(sessions.length).toBeGreaterThan(10);
    expect(unparsed.length).toBeLessThan(5); // only the doc title / trailing note
    expect(strength.length).toBeGreaterThan(10);
    expect(volume.find((v) => v.muscle === 'quads')).toBeTruthy();
    expect(asymmetry.length).toBeGreaterThan(0); // unilateral leg work produces LSI
    strength.forEach((s) => expect(Number.isFinite(s.slopePerWeek)).toBe(true));
  });
});
