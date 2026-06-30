<script lang="ts">
  import type { CalorieEntry } from '../data/types';

  // targetGrams = g/kg setting × bodyweight; 0 when bodyweight is unknown.
  let { entries, targetGrams }: { entries: CalorieEntry[]; targetGrams: number } = $props();

  const vals = $derived(entries.map((e) => e.protein).filter((p): p is number => p != null));
  const avg = $derived(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const hit = $derived(targetGrams > 0 ? vals.filter((p) => p >= targetGrams).length : 0);
  const pct = $derived(targetGrams > 0 ? Math.min(100, (avg / targetGrams) * 100) : 0);

  // green at/above target, amber within ~10%, red below
  const color = $derived(
    targetGrams === 0 || avg >= targetGrams ? '#2e7d5b' : avg >= targetGrams * 0.9 ? '#b4690e' : '#c0392b'
  );
</script>

<section class="card protein">
  <div class="cardhead">
    <h2>Protein</h2>
    <span class="hint">daily protein vs your target · the key hypertrophy nutrient</span>
  </div>

  <div class="row">
    <div class="big" style="color:{color}">{Math.round(avg)}<span class="unit">g/day avg</span></div>
    {#if targetGrams > 0}
      <div class="tgt">target <b>{Math.round(targetGrams)}g</b><br /><span class="sub">{hit}/{vals.length} days on target</span></div>
    {:else}
      <div class="tgt"><span class="sub">{vals.length} days logged</span></div>
    {/if}
  </div>

  {#if targetGrams > 0}
    <div class="track">
      <span class="fill" style="width:{pct}%; background:{color}"></span>
      <span class="goal" title="target"></span>
    </div>
  {/if}
</section>

<style>
  .protein .row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .big { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; line-height: 1; }
  .big .unit { font-size: 13px; font-weight: 400; color: var(--sub, #6b7280); margin-left: 6px; }
  .tgt { text-align: right; font-size: 13px; color: var(--ink, #1f2933); }
  .tgt .sub { font-size: 11.5px; color: var(--sub, #6b7280); }
  .track {
    position: relative;
    height: 10px;
    background: #f2eee4;
    border-radius: 6px;
    overflow: hidden;
    margin-top: 12px;
  }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; }
  .goal { position: absolute; right: 0; top: -1px; bottom: -1px; width: 2px; background: #b7ae99; }
</style>
