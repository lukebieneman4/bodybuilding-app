<script lang="ts">
  import { scaleLinear } from 'd3';
  import type { StrengthSummary, SummaryLine } from '../lift/analysis';

  let { summary }: { summary: StrengthSummary } = $props();

  let mode = $state<'muscle' | 'exercise'>('exercise');
  const lines = $derived(mode === 'muscle' ? summary.byMuscle : summary.byExercise);

  const W = 880;
  const H = 380;
  const M = { t: 24, r: 18, b: 36, l: 44 };

  // one colour per muscle group; lines inherit their primary muscle's colour
  const MUSCLE_COLORS: Record<string, string> = {
    chest: '#C0552B', lats: '#0E7C7B', traps: '#6B8E23', side_delt: '#C89B3C',
    rear_delt: '#8E6FB0', front_delt: '#D98A3D', biceps: '#2E7D5B', triceps: '#4F86C6',
    quads: '#C0392B', hamstrings: '#9C6B3F', glutes: '#B5651D', calves: '#557A95',
    abs: '#7A8B99', adductors: '#A88FC0', erectors: '#8A8D91',
  };
  const colorFor = (m: string | null): string => (m && MUSCLE_COLORS[m]) || '#9AA5B1';
  const muscleName = (m: string | null): string => (m ? m.replace('_', ' ') : 'other');

  const palette = { sub: '#6B7280', base: '#A8B0BA' };

  const yExtent = $derived.by<[number, number]>(() => {
    const vals = lines.flatMap((l) => l.points.map((p) => p.pct));
    if (vals.length === 0) return [90, 110];
    return [Math.min(100, ...vals), Math.max(100, ...vals)];
  });
  const x = $derived(scaleLinear([0, Math.max(1, summary.dayMax)], [M.l, W - M.r]));
  const y = $derived(scaleLinear([yExtent[0] - 2, yExtent[1] + 2], [H - M.b, M.t]));

  function path(l: SummaryLine): string {
    return l.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.pct).toFixed(1)}`).join('');
  }

  // legend: distinct muscles present, in display order of the lines
  const legend = $derived.by(() => {
    const seen = new Set<string>();
    const out: { muscle: string | null; color: string }[] = [];
    for (const l of lines) {
      const key = l.muscle ?? 'other';
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ muscle: l.muscle, color: colorFor(l.muscle) });
    }
    return out;
  });
</script>

<div class="head">
  <div class="toggle">
    <button class:active={mode === 'muscle'} onclick={() => (mode = 'muscle')}>By muscle</button>
    <button class:active={mode === 'exercise'} onclick={() => (mode = 'exercise')}>By exercise</button>
  </div>
</div>

{#if lines.length === 0}
  <p class="hint">Log a few sessions of the same lifts to see overall strength trends.</p>
{:else}
  <svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Overall strength progress, indexed to each exercise's start">
    {#each y.ticks(5) as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#ECE8DF" stroke-width="1" />
      <text x={M.l - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill={palette.sub}>{t}%</text>
    {/each}
    {#each x.ticks(7) as t}
      <text x={x(t)} y={H - M.b + 18} text-anchor="middle" font-size="11" fill={palette.sub}>{t.toFixed(0)}</text>
    {/each}
    <text x={(M.l + W - M.r) / 2} y={H - 4} text-anchor="middle" font-size="11" fill={palette.sub}>Day</text>

    <!-- baseline: each exercise's own starting strength -->
    <line x1={M.l} x2={W - M.r} y1={y(100)} y2={y(100)} stroke={palette.base} stroke-width="1.2" stroke-dasharray="2 3" />
    <text x={W - M.r} y={y(100) - 5} text-anchor="end" font-size="10" fill={palette.sub}>start (100%)</text>

    {#each lines as l}
      <path d={path(l)} fill="none" stroke={colorFor(l.muscle)}
        stroke-width={mode === 'muscle' ? 2.6 : 1.4}
        stroke-linejoin="round" stroke-linecap="round"
        opacity={mode === 'muscle' ? 0.95 : 0.7} />
      {#if mode === 'muscle' && l.points.length}
        <circle cx={x(l.points[l.points.length - 1].day)} cy={y(l.points[l.points.length - 1].pct)} r="3.5"
          fill={colorFor(l.muscle)} stroke="white" stroke-width="1.4" />
      {/if}
    {/each}
  </svg>

  <div class="legend">
    {#each legend as item}
      <span class="lg"><span class="sw" style="background:{item.color}"></span>{muscleName(item.muscle)}</span>
    {/each}
  </div>
  <p class="hint">
    Each line is a lift's e1RM indexed to its own first session (= 100%) — honest relative progress, since
    machine loads aren't comparable in absolute terms.
    {mode === 'muscle'
      ? ' Each line averages a muscle group’s currently-logged exercises — a change in which lifts (or gyms) are active can shift the average, so cross-check the by-exercise view.'
      : ' One line per exercise, coloured by muscle group.'}
  </p>
{/if}

<style>
  .head { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .toggle {
    display: inline-flex;
    gap: 4px;
    background: #f1ede4;
    border: 1px solid var(--line, #e7e2d8);
    border-radius: 9px;
    padding: 3px;
  }
  .toggle button {
    background: transparent;
    border: none;
    color: var(--sub, #6b7280);
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 7px;
    cursor: pointer;
  }
  .toggle button.active { background: #fff; color: var(--ink, #1f2933); box-shadow: 0 1px 2px rgba(31, 41, 51, 0.06); }
  .chart { width: 100%; height: auto; display: block; font-family: system-ui, -apple-system, sans-serif; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
  .lg { font-size: 11.5px; color: var(--sub, #6b7280); display: inline-flex; align-items: center; gap: 5px; text-transform: capitalize; }
  .sw { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
</style>
