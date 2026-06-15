<script lang="ts">
  import { scaleLinear } from 'd3';
  import type { IntakeAnalysis } from '../core/analysis';

  let { analysis }: { analysis: IntakeAnalysis } = $props();

  // viewBox space; the SVG scales to its container via width:100%
  const W = 880;
  const H = 380;
  const M = { t: 24, r: 20, b: 40, l: 56 };

  const palette = {
    ink: '#1F2933', sub: '#6B7280', tdee: '#0E7C7B', dot: '#9AA5B1', card: '#FFFFFF',
  };

  const a = $derived(analysis);
  const x = $derived(scaleLinear(a.xDomain, [M.l, W - M.r]));
  const y = $derived(scaleLinear(a.yDomain, [H - M.b, M.t]));

  const xs = $derived(a.series.map((p) => p.day));
  const mid = $derived(a.series.map((p) => p.tdee));
  const lo = $derived(a.series.map((p) => p.tdee - 1.96 * p.sd));
  const hi = $derived(a.series.map((p) => p.tdee + 1.96 * p.sd));

  function linePath(px: number[], py: number[]): string {
    return px.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(py[i]).toFixed(1)}`).join('');
  }
  function bandPath(px: number[], blo: number[], bhi: number[]): string {
    const top = px.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(bhi[i]).toFixed(1)}`).join('');
    let bottom = '';
    for (let i = px.length - 1; i >= 0; i--) bottom += `L${x(px[i]).toFixed(1)},${y(blo[i]).toFixed(1)}`;
    return top + bottom + 'Z';
  }

  const round10 = (v: number): number => Math.round(v / 10) * 10;
  const maint = $derived(round10(a.current.tdee));
  const band = $derived(round10(1.96 * a.current.sd));
  const eating = $derived(round10(a.current.intakeMean));
  const balance = $derived(eating - maint);
  const balanceText = $derived(
    balance < 0 ? `${-balance} kcal/day deficit` : balance > 0 ? `${balance} kcal/day surplus` : 'at maintenance'
  );
  const lastDay = $derived(a.xDomain[1]);
</script>

<svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Calories and estimated maintenance chart">
  <!-- y gridlines + ticks (kcal) -->
  {#each y.ticks(6) as t}
    <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#ECE8DF" stroke-width="1" />
    <text x={M.l - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill={palette.sub}>{t}</text>
  {/each}
  <text transform="translate(16,{(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle"
        font-size="11" fill={palette.sub}>kcal / day</text>

  <!-- x ticks (day) -->
  {#each x.ticks(8) as t}
    <text x={x(t)} y={H - M.b + 18} text-anchor="middle" font-size="11" fill={palette.sub}>{t}</text>
  {/each}
  <text x={(M.l + W - M.r) / 2} y={H - 6} text-anchor="middle" font-size="11" fill={palette.sub}>Day</text>

  <!-- daily intake scatter -->
  {#each a.intake as p}
    <circle cx={x(p.day)} cy={y(p.kcal)} r="2.6" fill={palette.dot} opacity="0.5" />
  {/each}

  <!-- maintenance band + line -->
  {#if a.series.length >= 2}
    <path d={bandPath(xs, lo, hi)} fill={palette.tdee} opacity="0.12" />
    <path d={linePath(xs, mid)} fill="none" stroke={palette.tdee} stroke-width="3"
          stroke-linejoin="round" stroke-linecap="round" />
  {/if}

  <!-- current maintenance marker -->
  <circle cx={x(lastDay)} cy={y(a.current.tdee)} r="5" fill={palette.tdee} stroke="white" stroke-width="1.6" />

  <!-- corner stat card -->
  <g transform="translate({W - M.r - 232}, {M.t + 6})">
    <rect width="232" height="92" rx="10" fill={palette.card} opacity="0.92" />
    <circle cx="18" cy="22" r="5" fill={palette.tdee} />
    <text x="30" y="26" font-size="14" font-weight="700" fill={palette.tdee}>Maintenance</text>
    <text x="16" y="54" font-size="22" font-weight="700" fill={palette.ink}>
      {maint} <tspan font-size="13" font-weight="400" fill={palette.sub}>± {band} kcal</tspan>
    </text>
    <text x="16" y="72" font-size="11" fill={palette.sub}>eating ~{eating} kcal/day</text>
    <text x="16" y="86" font-size="10.5" fill={palette.sub}>{balanceText}</text>
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
