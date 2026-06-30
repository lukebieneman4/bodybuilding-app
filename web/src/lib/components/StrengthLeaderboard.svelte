<script lang="ts">
  import type { StrengthSeries } from '../lift/analysis';
  import { mixedScale } from '../lift/analysis';
  import { progressionCue } from '../lift/progression';
  import { store } from '../data/store.svelte';
  import StrengthChart from './StrengthChart.svelte';

  let { strength }: { strength: StrengthSeries[] } = $props();

  const showProg = $derived(store.settings.progressionCoach);
  const CUE_COLOR: Record<string, string> = { overload: '#2e7d5b', intensity: '#b4690e', stall: '#c0392b' };

  type SortKey = 'progress' | 'rate' | 'sessions';
  let sort = $state<SortKey>('progress');
  let open = $state<string | null>(null);

  const idOf = (s: StrengthSeries): string => `${s.key}|${s.location ?? ''}|${s.limb ?? ''}`;

  // chartable lifts only: need ≥2 points, a real baseline, and a single load scale
  // (a series mixing absolute and "+N" over-stack loads isn't self-comparable).
  const rows = $derived.by(() => {
    const list = strength
      .filter((s) => s.points.length >= 2 && !mixedScale(s.points) && s.trend[0] > 0)
      .map((s) => ({
        s,
        id: idOf(s),
        progress: (s.current / s.trend[0] - 1) * 100, // % change since first session
        rate: (s.slopePerWeek / s.current) * 100, // %/week (recent trend slope)
        sessions: s.points.length,
      }));
    const cmp: Record<SortKey, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      progress: (a, b) => b.progress - a.progress,
      rate: (a, b) => b.rate - a.rate,
      sessions: (a, b) => b.sessions - a.sessions,
    };
    return list.sort(cmp[sort]);
  });

  function toggle(id: string): void {
    open = open === id ? null : id;
  }

  // sparkline path from the smoothed trend, normalized to its own min/max
  const SW = 60;
  const SH = 22;
  const SP = 2;
  function spark(trend: number[]): string {
    if (trend.length < 2) return '';
    const min = Math.min(...trend);
    const max = Math.max(...trend);
    const span = max - min || 1;
    return trend
      .map((v, i) => {
        const x = SP + (i / (trend.length - 1)) * (SW - 2 * SP);
        const y = SH - SP - ((v - min) / span) * (SH - 2 * SP);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join('');
  }

  const UP = '#2E7D5B';
  const DOWN = '#B4690E';
  const FLAT = '#9AA5B1';
  const dir = (n: number): string => (n > 0.2 ? UP : n < -0.2 ? DOWN : FLAT);
  const fmtPct = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(Math.abs(n) >= 10 ? 0 : 1)}%`;
  const sortHint: Record<SortKey, string> = {
    progress: 'biggest total change first',
    rate: 'recent rate of change first',
    sessions: 'most-logged first',
  };
</script>

{#if rows.length === 0}
  <p class="hint">Log a couple more sessions of the same lift to see progress.</p>
{:else}
  <div class="sort" role="tablist" aria-label="Sort lifts">
    <button class:active={sort === 'progress'} onclick={() => (sort = 'progress')}>Progress</button>
    <button class:active={sort === 'rate'} onclick={() => (sort = 'rate')}>Rate</button>
    <button class:active={sort === 'sessions'} onclick={() => (sort = 'sessions')}>Sessions</button>
  </div>

  <ul class="board">
    {#each rows as r (r.id)}
      <li class="item" class:expanded={open === r.id}>
        <button class="row" onclick={() => toggle(r.id)} aria-expanded={open === r.id}>
          <span class="name">
            <span class="txt">{r.s.rawName}</span>
            {#if r.s.limb}<span class="limb">{r.s.limb}</span>{/if}
            {#if r.s.location}<span class="loc">{r.s.location}</span>{/if}
          </span>
          <svg class="spark" viewBox="0 0 {SW} {SH}" aria-hidden="true">
            <path d={spark(r.s.trend)} fill="none" stroke={dir(r.rate)} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          <span class="metrics">
            <span class="delta" style="color:{dir(r.progress)}">{fmtPct(r.progress)}</span>
            <span class="rate">{r.rate >= 0 ? '▲' : '▼'} {Math.abs(r.rate).toFixed(1)}%/wk</span>
          </span>
          <span class="caret">{open === r.id ? '▾' : '▸'}</span>
        </button>
        {#if open === r.id}
          <div class="detail">
            {#if showProg}
              {@const cue = progressionCue(r.s)}
              {#if cue}
                <div class="cue" style="border-color:{CUE_COLOR[cue.kind]}">
                  <span class="cue-h" style="color:{CUE_COLOR[cue.kind]}">Next session · {cue.headline}</span>
                  <p>{cue.detail}</p>
                  <span class="cue-cite">{cue.cite}</span>
                </div>
              {/if}
            {/if}
            <StrengthChart series={r.s} />
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="hint">
    Each lift indexed to its own first session ({sortHint[sort]}) · tap a lift for its e1RM trend &amp; confidence band.
  </p>
{/if}

<style>
  .sort {
    display: inline-flex;
    gap: 4px;
    background: #f1ede4;
    border: 1px solid var(--line, #e7e2d8);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 8px;
  }
  .sort button {
    background: transparent;
    border: none;
    color: var(--sub, #6b7280);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 7px;
    cursor: pointer;
  }
  .sort button.active {
    background: #fff;
    color: var(--ink, #1f2933);
    box-shadow: 0 1px 2px rgba(31, 41, 51, 0.06);
  }

  .board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .item { border-bottom: 1px solid #f0ece3; }
  .item:last-child { border-bottom: none; }

  .row {
    display: grid;
    grid-template-columns: 1fr 60px auto 14px;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: transparent;
    border: none;
    padding: 9px 4px;
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .row:hover { background: #f8f5ef; }

  .name {
    display: flex;
    align-items: baseline;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1f2933);
  }
  .name .txt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: capitalize;
  }
  .limb,
  .loc { flex: 0 0 auto; }
  .limb {
    font-size: 10px;
    font-weight: 700;
    color: var(--teal-d, #0a5f5e);
    background: #e3efee;
    border-radius: 4px;
    padding: 1px 4px;
    margin-left: 5px;
    text-transform: none;
  }
  .loc { font-size: 11px; font-weight: 400; color: var(--sub, #6b7280); margin-left: 6px; text-transform: none; }

  .spark { width: 60px; height: 22px; display: block; }

  .metrics { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; }
  .delta { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .rate { font-size: 10.5px; color: var(--sub, #6b7280); font-variant-numeric: tabular-nums; }

  .caret { font-size: 10px; color: var(--sub, #6b7280); }
  .detail { padding: 4px 2px 12px; }
  .cue {
    border-left: 3px solid;
    background: #f8f5ef;
    border-radius: 0 8px 8px 0;
    padding: 8px 12px;
    margin: 2px 0 12px;
  }
  .cue-h { font-size: 13px; font-weight: 700; }
  .cue p { margin: 3px 0 2px; font-size: 12.5px; line-height: 1.45; color: var(--ink, #1f2933); }
  .cue-cite { font-size: 10.5px; color: var(--sub, #6b7280); font-style: italic; }
</style>
