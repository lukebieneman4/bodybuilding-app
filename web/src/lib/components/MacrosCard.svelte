<script lang="ts">
  import type { MacroTargets } from '../core/macros';
  import { KCAL_PER_G } from '../core/macros';
  import type { CalorieEntry } from '../data/types';

  let { targets, proteinEntries = [] }: { targets: MacroTargets; proteinEntries?: CalorieEntry[] } = $props();

  // protein adherence (the one macro we log)
  const vals = $derived(proteinEntries.map((e) => e.protein).filter((p): p is number => p != null));
  const avgP = $derived(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const hit = $derived(targets.protein > 0 ? vals.filter((p) => p >= targets.protein).length : 0);

  const C = { protein: '#0e7c7b', carb: '#b5651d', fat: '#c89b3c' };
  const rows = $derived([
    { key: 'Protein', g: targets.protein, kcal: targets.protein * KCAL_PER_G.protein, color: C.protein },
    ...(targets.carb != null
      ? [{ key: 'Carbs', g: targets.carb, kcal: targets.carb * KCAL_PER_G.carb, color: C.carb }]
      : []),
    { key: 'Fat', g: targets.fat, kcal: targets.fat * KCAL_PER_G.fat, color: C.fat },
  ]);
  const total = $derived(rows.reduce((s, r) => s + r.kcal, 0) || 1);
</script>

<section class="card macros">
  <div class="cardhead">
    <h2>Macro targets</h2>
    <span class="hint">
      {targets.source === 'custom' ? 'your custom targets' : 'protein + fat set, carbs fill the rest'} · the hypertrophy split
    </span>
  </div>

  <div class="bar">
    {#each rows as r}
      <span class="seg" style="width:{(r.kcal / total) * 100}%; background:{r.color}" title="{r.key} {Math.round(r.g)}g"></span>
    {/each}
  </div>

  <div class="legend">
    {#each rows as r}
      <span class="lg"><span class="dot" style="background:{r.color}"></span>{r.key} <b>{Math.round(r.g)}g</b></span>
    {/each}
    <span class="kcal">≈ {Math.round(targets.calories).toLocaleString()} kcal</span>
  </div>

  {#if targets.carb == null}
    <p class="note">Log calories to get a carb target (carbs fill the energy left after protein &amp; fat).</p>
  {:else if targets.clipped}
    <p class="note">Protein + fat already meet this calorie target — carbs at 0. Raise calories or lower the protein/fat targets.</p>
  {:else if targets.fatFloored}
    <p class="note">Fat raised to the ~20%-of-calories floor (hormonal health).</p>
  {/if}

  {#if avgP != null}
    <p class="adh">
      Protein so far: <b>{Math.round(avgP)}g/day</b> avg · {hit}/{vals.length} days on target
    </p>
  {/if}
</section>

<style>
  .bar {
    display: flex;
    height: 14px;
    border-radius: 7px;
    overflow: hidden;
    background: #f2eee4;
    margin: 2px 0 10px;
  }
  .seg { display: block; height: 100%; }
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
  .lg { font-size: 13px; color: var(--ink, #1f2933); display: inline-flex; align-items: center; gap: 6px; }
  .lg b { font-variant-numeric: tabular-nums; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .kcal { margin-left: auto; font-size: 12.5px; color: var(--sub, #6b7280); font-variant-numeric: tabular-nums; }
  .note { margin: 10px 0 0; font-size: 12px; color: var(--sub, #6b7280); line-height: 1.45; }
  .adh { margin: 10px 0 0; font-size: 12.5px; color: var(--ink, #1f2933); }
  .adh b { font-variant-numeric: tabular-nums; }
</style>
