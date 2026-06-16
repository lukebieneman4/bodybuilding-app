<script lang="ts">
  import type { MuscleVolume } from '../lift/analysis';
  import type { VolumeStatus } from '../lift/muscles';

  let { volume }: { volume: MuscleVolume[] } = $props();

  const SCALE_MAX = 30; // covers the largest MRV (traps ~30 sets/wk)
  const pct = (v: number): number => Math.min(100, (v / SCALE_MAX) * 100);

  const STATUS: Record<VolumeStatus, { color: string; label: string }> = {
    below_mev: { color: '#B4690E', label: 'below MEV' },
    minimum: { color: '#C08552', label: 'near MEV' },
    optimal: { color: '#2E7D5B', label: 'in MAV' },
    high: { color: '#B4690E', label: 'near MRV' },
    above_mrv: { color: '#C0392B', label: 'over MRV' },
    none: { color: '#9AA5B1', label: '' },
  };
  const name = (m: string): string => m.replace('_', ' ');

  let open = $state(new Set<string>());
  function toggle(m: string): void {
    const s = new Set(open);
    s.has(m) ? s.delete(m) : s.add(m);
    open = s;
  }
</script>

<div class="vol">
  {#each volume as v}
    <div class="grp">
      <button class="row" onclick={() => toggle(v.muscle)} aria-expanded={open.has(v.muscle)} title="Show the exercises behind this number">
        <span class="caret">{open.has(v.muscle) ? '▾' : '▸'}</span>
        <span class="muscle">{name(v.muscle)}</span>
        <span class="track">
          {#if v.landmark}
            <span class="mav" style="left:{pct(v.landmark.mav[0])}%; width:{pct(v.landmark.mav[1]) - pct(v.landmark.mav[0])}%"></span>
            <span class="tick" style="left:{pct(v.landmark.mev)}%" title="MEV {v.landmark.mev}"></span>
            <span class="tick mrv" style="left:{pct(v.landmark.mrv)}%" title="MRV {v.landmark.mrv}"></span>
          {/if}
          <span class="bar" style="width:{pct(v.setsPerWeek)}%; background:{STATUS[v.status].color}"></span>
        </span>
        <span class="val">{v.setsPerWeek.toFixed(1)}</span>
        <span class="status" style="color:{STATUS[v.status].color}">{STATUS[v.status].label}</span>
      </button>

      {#if open.has(v.muscle)}
        <ul class="detail">
          {#each v.contributions as c}
            <li>
              <span class="ex">{c.rawName}</span>
              <span class="calc">
                {c.hardSets} {c.hardSets === 1 ? 'set' : 'sets'} × {c.creditPerSet}
                <span class="role">{c.role === 'secondary' ? 'secondary' : 'primary'}</span>
              </span>
              <span class="sub">{c.setsPerWeek.toFixed(1)}/wk</span>
            </li>
          {/each}
          <li class="sum">
            <span class="ex">trailing 2 weeks ÷ 2</span>
            <span class="calc"></span>
            <span class="sub">{v.setsPerWeek.toFixed(1)}/wk</span>
          </li>
        </ul>
      {/if}
    </div>
  {/each}
  <p class="legend">
    sets / week (RIR ≤ 3) · <span class="sw mav"></span> productive band (MAV) · │ MEV &amp; MRV · click a row for the breakdown
  </p>
</div>

<style>
  .vol { display: flex; flex-direction: column; gap: 2px; }
  .row {
    display: grid;
    grid-template-columns: 16px 80px 1fr 34px 62px;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 5px 4px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-weight: 400;
  }
  .row:hover { background: #f6f2ea; }
  .caret { font-size: 9px; color: var(--sub, #6B7280); }
  .muscle { font-size: 12.5px; color: var(--ink, #1F2933); text-transform: capitalize; text-align: right; }
  .track { position: relative; height: 16px; background: #F2EEE4; border-radius: 5px; overflow: hidden; display: block; }
  .mav { position: absolute; top: 0; bottom: 0; background: rgba(46, 125, 91, 0.14); }
  .tick { position: absolute; top: -1px; bottom: -1px; width: 2px; background: #B7AE99; }
  .tick.mrv { background: #C9897C; }
  .bar { position: absolute; top: 3px; bottom: 3px; left: 0; border-radius: 4px; }
  .val { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ink, #1F2933); }
  .status { font-size: 10.5px; }

  .detail {
    list-style: none;
    margin: 2px 0 8px;
    padding: 6px 4px 6px 34px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-left: 2px solid #ECE8DF;
    margin-left: 14px;
  }
  .detail li { display: grid; grid-template-columns: 1fr auto 64px; align-items: baseline; gap: 12px; font-size: 12px; }
  .detail .ex { color: var(--ink, #1F2933); }
  .detail .calc { color: var(--sub, #6B7280); font-variant-numeric: tabular-nums; }
  .detail .role { font-size: 10px; color: #9AA5B1; margin-left: 4px; }
  .detail .sub { text-align: right; color: var(--ink, #1F2933); font-variant-numeric: tabular-nums; }
  .detail .sum { border-top: 1px solid #ECE8DF; margin-top: 2px; padding-top: 4px; font-weight: 600; }
  .detail .sum .ex { color: var(--sub, #6B7280); font-weight: 400; font-style: italic; }

  .legend { font-size: 10.5px; color: var(--sub, #6B7280); margin: 8px 0 0; }
  .sw { display: inline-block; width: 14px; height: 9px; vertical-align: middle; border-radius: 2px; }
  .sw.mav { background: rgba(46, 125, 91, 0.25); }
</style>
