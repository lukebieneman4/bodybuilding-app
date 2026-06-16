<script lang="ts">
  import type { AsymmetrySeries } from '../lift/analysis';

  let { asymmetry }: { asymmetry: AsymmetrySeries[] } = $props();

  const TARGET = 90; // LSI goal line — a progress proxy, NOT medical clearance (SCIENCE.md §5)

  function color(lsi: number): string {
    if (lsi >= TARGET) return '#2E7D5B';
    if (lsi >= 75) return '#C08552';
    if (lsi >= 50) return '#B4690E';
    return '#C0392B';
  }
  const pct = (v: number): number => Math.min(100, v);
  const sorted = $derived([...asymmetry].sort((a, b) => a.currentLSI - b.currentLSI));
  const label = (a: AsymmetrySeries): string => `${a.rawName}${a.location ? ' · ' + a.location : ''}`;
</script>

<div class="sym">
  {#each sorted as a}
    <div class="row">
      <span class="ex">{label(a)}</span>
      <div class="track">
        <span class="target" style="left:{TARGET}%" title="90% goal"></span>
        <span class="bar" style="width:{pct(a.currentLSI)}%; background:{color(a.currentLSI)}"></span>
      </div>
      <span class="val" style="color:{color(a.currentLSI)}">{a.currentLSI.toFixed(0)}%</span>
    </div>
  {/each}
  <p class="note">
    LSI = surgical ÷ healthy side · dashed line = 90% goal. A training-progress proxy, <b>not</b> medical
    clearance — load/return decisions belong to your surgeon &amp; physio.
  </p>
</div>

<style>
  .sym { display: flex; flex-direction: column; gap: 7px; }
  .row { display: grid; grid-template-columns: 1fr 130px 42px; align-items: center; gap: 10px; }
  .ex { font-size: 12.5px; color: var(--ink, #1F2933); text-align: right; }
  .track { position: relative; height: 16px; background: #F2EEE4; border-radius: 5px; overflow: hidden; }
  .bar { position: absolute; top: 3px; bottom: 3px; left: 0; border-radius: 4px; }
  .target { position: absolute; top: -1px; bottom: -1px; width: 0; border-left: 1.5px dashed #2E7D5B; opacity: 0.7; }
  .val { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .note { font-size: 10.5px; color: var(--sub, #6B7280); margin: 8px 0 0; line-height: 1.5; }
</style>
