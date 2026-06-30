<script lang="ts">
  import { scaleLinear } from 'd3';
  import type { StrengthSummary, SummaryLine } from '../lift/analysis';
  import { shortDate } from '../format';

  let { summary }: { summary: StrengthSummary } = $props();
  const xLabel = $derived((t: number): string =>
    summary.startDate ? shortDate(summary.startDate, t) : t.toFixed(0));

  const W = 880;
  const H = 380;
  const M = { t: 24, r: 18, b: 36, l: 44 };

  // one colour per muscle group (overview); lines inherit their primary muscle's colour
  const MUSCLE_COLORS: Record<string, string> = {
    chest: '#C0552B', lats: '#0E7C7B', traps: '#6B8E23', side_delt: '#C89B3C',
    rear_delt: '#8E6FB0', front_delt: '#D98A3D', biceps: '#2E7D5B', triceps: '#4F86C6',
    quads: '#C0392B', hamstrings: '#9C6B3F', glutes: '#B5651D', calves: '#557A95',
    abs: '#7A8B99', adductors: '#A88FC0', erectors: '#8A8D91',
  };
  const colorFor = (m: string | null): string => (m && MUSCLE_COLORS[m]) || '#9AA5B1';
  const muscleName = (m: string | null): string => (m ? m.replace('_', ' ') : 'other');

  // distinct categorical palette for the per-muscle drill-down (lines are one
  // muscle, so colour-by-muscle no longer separates them — colour by exercise)
  const CAT = ['#0E7C7B', '#C0552B', '#6B8E23', '#8E6FB0', '#C89B3C', '#4F86C6', '#B5651D', '#A0526B', '#557A95', '#2E7D5B'];
  const catColor = (i: number): string => CAT[i % CAT.length];

  const palette = { sub: '#6B7280', base: '#A8B0BA' };

  // 'overview' = one line per muscle group; otherwise drill into one body part.
  let view = $state<string>('overview');
  // muscle groups that have exercise lines, in overview (current-progress) order
  const groups = $derived.by<string[]>(() => {
    const order = summary.byMuscle.map((l) => l.muscle).filter((m): m is NonNullable<typeof m> => m != null);
    const presentArr = summary.byExercise.map((l) => l.muscle).filter((m): m is NonNullable<typeof m> => m != null);
    const present = new Set<string>(presentArr);
    const ranked: string[] = [];
    for (const m of order) if (present.has(m) && !ranked.includes(m)) ranked.push(m);
    for (const m of presentArr) if (!ranked.includes(m)) ranked.push(m);
    return ranked;
  });
  // keep the selection valid as data changes
  $effect(() => {
    if (view !== 'overview' && !groups.includes(view)) view = 'overview';
  });

  const lines = $derived(
    view === 'overview' ? summary.byMuscle : summary.byExercise.filter((l) => l.muscle === view)
  );
  const strokeFor = (l: SummaryLine, i: number): string =>
    view === 'overview' ? colorFor(l.muscle) : catColor(i);

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

  const legend = $derived.by(() => {
    if (view === 'overview') {
      const seen = new Set<string>();
      const out: { label: string; color: string }[] = [];
      for (const l of lines) {
        const key = l.muscle ?? 'other';
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label: muscleName(l.muscle), color: colorFor(l.muscle) });
      }
      return out;
    }
    return lines.map((l, i) => ({ label: l.label, color: catColor(i) }));
  });
</script>

<div class="head">
  <select bind:value={view} class="picker" aria-label="View overall progress, or drill into one muscle group">
    <option value="overview">Overview — by muscle group</option>
    {#each groups as g}
      <option value={g}>{muscleName(g)} — exercises</option>
    {/each}
  </select>
</div>

{#if lines.length === 0}
  <p class="hint">Log a few sessions of the same lifts to see overall strength trends.</p>
{:else}
  <svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Strength progress, indexed to each exercise's start">
    {#each y.ticks(5) as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#ECE8DF" stroke-width="1" />
      <text x={M.l - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill={palette.sub}>{t}%</text>
    {/each}
    {#each x.ticks(6) as t}
      <text x={x(t)} y={H - M.b + 18} text-anchor="middle" font-size="11" fill={palette.sub}>{xLabel(t)}</text>
    {/each}

    <!-- baseline: each exercise's own starting strength -->
    <line x1={M.l} x2={W - M.r} y1={y(100)} y2={y(100)} stroke={palette.base} stroke-width="1.2" stroke-dasharray="2 3" />
    <text x={W - M.r} y={y(100) - 5} text-anchor="end" font-size="10" fill={palette.sub}>start (100%)</text>

    {#each lines as l, i}
      <path d={path(l)} fill="none" stroke={strokeFor(l, i)}
        stroke-width={view === 'overview' ? 2.6 : 2}
        stroke-linejoin="round" stroke-linecap="round"
        opacity={view === 'overview' ? 0.95 : 0.9} />
      {#if l.points.length}
        <circle cx={x(l.points[l.points.length - 1].day)} cy={y(l.points[l.points.length - 1].pct)} r="3.5"
          fill={strokeFor(l, i)} stroke="white" stroke-width="1.4" />
      {/if}
    {/each}
  </svg>

  <div class="legend">
    {#each legend as item}
      <span class="lg"><span class="sw" style="background:{item.color}"></span>{item.label}</span>
    {/each}
  </div>
  <p class="hint">
    Each line is a lift's e1RM indexed to its own first session (= 100%) — honest relative progress, since
    machine loads aren't comparable in absolute terms.
    {view === 'overview'
      ? ' Each line averages a muscle group’s currently-logged exercises — pick a group above to see its individual lifts.'
      : ` Individual ${muscleName(view)} lifts, each on its own colour.`}
  </p>
{/if}

<style>
  .head { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .picker {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--line, #E3DDD0);
    border-radius: 8px;
    font-size: 13px;
    background: white;
    color: var(--ink, #1f2933);
  }
  .chart { width: 100%; height: auto; display: block; font-family: system-ui, -apple-system, sans-serif; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
  .lg { font-size: 11.5px; color: var(--sub, #6b7280); display: inline-flex; align-items: center; gap: 5px; text-transform: capitalize; }
  .sw { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
</style>
