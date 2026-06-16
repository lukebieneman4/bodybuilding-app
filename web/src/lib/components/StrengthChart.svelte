<script lang="ts">
  import { scaleLinear } from 'd3';
  import type { StrengthSeries } from '../lift/analysis';

  let { series }: { series: StrengthSeries } = $props();

  const W = 880;
  const H = 340;
  const M = { t: 22, r: 20, b: 36, l: 48 };
  const palette = { ink: '#1F2933', sub: '#6B7280', trend: '#0E7C7B', dot: '#9AA5B1', card: '#FFFFFF', up: '#2E7D5B', down: '#B4690E' };

  const s = $derived(series);
  const xDomain = $derived<[number, number]>([
    s.points[0]?.day ?? 0,
    s.points[s.points.length - 1]?.day ?? 1,
  ]);
  const ys = $derived([...s.points.map((p) => p.e1rm), ...s.band.flat()]);
  const yDomain = $derived<[number, number]>([Math.min(...ys) * 0.97, Math.max(...ys) * 1.03]);
  const x = $derived(scaleLinear(xDomain[0] === xDomain[1] ? [xDomain[0] - 1, xDomain[0] + 1] : xDomain, [M.l, W - M.r]));
  const y = $derived(scaleLinear(yDomain, [H - M.b, M.t]));

  const line = (xs: number[], vs: number[]): string =>
    xs.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(vs[i]).toFixed(1)}`).join('');
  const band = $derived.by(() => {
    const xs = s.points.map((p) => p.day);
    const top = xs.map((xi, i) => `${i ? 'L' : 'M'}${x(xi).toFixed(1)},${y(s.band[i][1]).toFixed(1)}`).join('');
    let bot = '';
    for (let i = xs.length - 1; i >= 0; i--) bot += `L${x(xs[i]).toFixed(1)},${y(s.band[i][0]).toFixed(1)}`;
    return top + bot + 'Z';
  });

  const slopeColor = $derived(s.slopePerWeek >= 0 ? palette.up : palette.down);
  const label = $derived(`${s.rawName}${s.limb ? ' · ' + (s.limb === 'R' ? 'right' : 'left') : ''}${s.location ? ' · ' + s.location : ''}`);
</script>

<svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Strength trend for {label}">
  {#each y.ticks(5) as t}
    <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#ECE8DF" stroke-width="1" />
    <text x={M.l - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill={palette.sub}>{t.toFixed(0)}</text>
  {/each}
  {#each x.ticks(7) as t}
    <text x={x(t)} y={H - M.b + 18} text-anchor="middle" font-size="11" fill={palette.sub}>{t.toFixed(0)}</text>
  {/each}
  <text x={(M.l + W - M.r) / 2} y={H - 4} text-anchor="middle" font-size="11" fill={palette.sub}>Day</text>

  {#if s.points.length >= 2}
    <path d={band} fill={palette.trend} opacity="0.12" />
    <path d={line(s.points.map((p) => p.day), s.trend)} fill="none" stroke={palette.trend} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
  {/if}

  {#each s.points as p}
    <circle cx={x(p.day)} cy={y(p.e1rm)} r="3"
      fill={p.confidence === 'high' ? palette.dot : 'white'}
      stroke={palette.dot} stroke-width="1.2" opacity={p.confidence === 'high' ? 0.7 : 0.9} />
  {/each}
  {#if s.points.length}
    <circle cx={x(s.points[s.points.length - 1].day)} cy={y(s.current)} r="5" fill={palette.trend} stroke="white" stroke-width="1.6" />
  {/if}

  <g transform="translate({W - M.r - 232}, {M.t + 4})">
    <rect width="232" height="74" rx="10" fill={palette.card} opacity="0.92" />
    <text x="16" y="24" font-size="12.5" font-weight="700" fill={palette.ink}>{label}</text>
    <text x="16" y="50" font-size="22" font-weight="700" fill={palette.ink}>{s.current.toFixed(0)}
      <tspan font-size="12" font-weight="400" fill={palette.sub}> index</tspan></text>
    <text x="16" y="66" font-size="11" fill={slopeColor}>
      {s.slopePerWeek >= 0 ? '▲' : '▼'} {s.slopePerWeek >= 0 ? '+' : ''}{s.slopePerWeek.toFixed(1)}/wk
    </text>
  </g>
</svg>

<style>
  .chart { width: 100%; height: auto; display: block; font-family: system-ui, -apple-system, sans-serif; }
</style>
