<script lang="ts">
  import { scaleLinear } from 'd3';
  import type { WeightAnalysis } from '../core/analysis';

  let { analysis }: { analysis: WeightAnalysis } = $props();

  // viewBox space; the SVG scales to its container via width:100%
  const W = 880;
  const H = 500;
  const M = { t: 24, r: 20, b: 40, l: 52 };

  const palette = {
    ink: '#1F2933', sub: '#6B7280', trend: '#0E7C7B', ideal: '#C08552',
    dot: '#9AA5B1', goal: '#A8B0BA', good: '#2E7D5B', warn: '#B4690E', card: '#FFFFFF',
  };

  const x = $derived(scaleLinear(analysis.xDomain, [M.l, W - M.r]));
  const y = $derived(scaleLinear(analysis.yDomain, [H - M.b, M.t]));

  function linePath(xs: number[], ys: number[]): string {
    return xs.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(ys[i]).toFixed(1)}`).join('');
  }
  function bandPath(xs: number[], lo: number[], hi: number[]): string {
    const top = xs.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(hi[i]).toFixed(1)}`).join('');
    let bottom = '';
    for (let i = xs.length - 1; i >= 0; i--) bottom += `L${x(xs[i]).toFixed(1)},${y(lo[i]).toFixed(1)}`;
    return top + bottom + 'Z';
  }

  const a = $derived(analysis);
  const statusColor = $derived(a.current.status === 'on' ? palette.good : palette.warn);
  const statusLabel = $derived(
    a.current.status === 'on' ? 'On track' : a.current.status === 'fast' ? 'Slightly fast' : 'Behind pace'
  );
  const rateText = $derived(
    `${a.current.ratePerWk >= 0 ? '+' : ''}${a.current.ratePerWk.toFixed(2)} ${a.units}/wk · ` +
      `${a.current.ratePct >= 0 ? '+' : ''}${a.current.ratePct.toFixed(2)}%/wk`
  );
  const etaText = $derived(
    a.current.etaWeeks === null
      ? 'goal pace unclear'
      : a.current.etaRange
        ? `goal in ~${Math.round(a.current.etaWeeks)} wk (${Math.round(a.current.etaRange[0])}–${Math.round(a.current.etaRange[1])} wk)`
        : `projected goal in ~${Math.round(a.current.etaWeeks)} wk`
  );
</script>

<svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Bodyweight trend chart">
  <!-- y gridlines + ticks -->
  {#each y.ticks(6) as t}
    <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#ECE8DF" stroke-width="1" />
    <text x={M.l - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill={palette.sub}>{t}</text>
  {/each}
  <!-- x ticks -->
  {#each x.ticks(8) as t}
    <text x={x(t)} y={H - M.b + 18} text-anchor="middle" font-size="11" fill={palette.sub}>{t}</text>
  {/each}
  <text x={(M.l + W - M.r) / 2} y={H - 6} text-anchor="middle" font-size="11" fill={palette.sub}>Day</text>

  <!-- goal line -->
  <line x1={M.l} x2={W - M.r} y1={y(a.goalDisplay)} y2={y(a.goalDisplay)}
        stroke={palette.goal} stroke-width="1.2" stroke-dasharray="2 3" />
  <text x={W - M.r} y={y(a.goalDisplay) - 5} text-anchor="end" font-size="10" fill={palette.sub}>
    goal {a.goalDisplay.toFixed(0)} {a.units}
  </text>

  <!-- target date -->
  {#if a.targetDateDay !== null}
    <line x1={x(a.targetDateDay)} x2={x(a.targetDateDay)} y1={M.t} y2={H - M.b}
          stroke={palette.goal} stroke-width="1" stroke-dasharray="1 3" />
  {/if}

  <!-- ideal target -->
  <path d={linePath(a.ideal.days, a.ideal.values)} fill="none" stroke={palette.ideal}
        stroke-width="1.8" stroke-dasharray="6 5" opacity="0.9" />

  <!-- confidence band -->
  <path d={bandPath(a.days, a.bandLo, a.bandHi)} fill={palette.trend} opacity="0.13" />

  <!-- raw weigh-ins -->
  {#each a.days as d, i}
    <circle cx={x(d)} cy={y(a.obs[i])} r="2.6" fill={palette.dot} opacity="0.5" />
  {/each}

  <!-- projection (line only; uncertainty shown as ETA range in the card) -->
  <path d={linePath(a.projection.days, a.projection.level)} fill="none" stroke={palette.trend}
        stroke-width="2.2" stroke-dasharray="1 4" stroke-linecap="round" opacity="0.85" />

  <!-- trend -->
  <path d={linePath(a.days, a.trend)} fill="none" stroke={palette.trend} stroke-width="3"
        stroke-linejoin="round" stroke-linecap="round" />

  <!-- markers -->
  <circle cx={x(a.lastDay)} cy={y(a.current.trendDisplay)} r="5" fill={palette.trend}
          stroke="white" stroke-width="1.6" />
  {#if a.projection.goalEtaDay !== null}
    <circle cx={x(a.projection.goalEtaDay)} cy={y(a.goalDisplay)} r="4.5" fill={palette.trend}
            stroke="white" stroke-width="1.6" />
  {/if}

  <!-- corner stat card -->
  <g transform="translate({W - M.r - 232}, {M.t + 6})">
    <rect width="232" height="92" rx="10" fill={palette.card} opacity="0.92" />
    <circle cx="18" cy="22" r="5" fill={statusColor} />
    <text x="30" y="26" font-size="14" font-weight="700" fill={statusColor}>{statusLabel}</text>
    <text x="16" y="54" font-size="22" font-weight="700" fill={palette.ink}>
      {a.current.trendDisplay.toFixed(1)} {a.units}
    </text>
    <text x="16" y="72" font-size="11" fill={palette.sub}>{rateText}</text>
    <text x="16" y="86" font-size="10.5" fill={palette.sub}>{etaText}</text>
  </g>
</svg>

<style>
  .chart {
    width: 100%;
    height: auto;
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
