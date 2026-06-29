<script lang="ts">
  import { store, todayISO } from '../data/store.svelte';
  import { toKg, fromKg } from '../data/types';
  import type { WeighIn, CalorieEntry } from '../data/types';
  import { parseBulkLog, summarize, formatBulkLog } from '../data/bulklog';

  const units = $derived(store.profile?.units ?? 'lb');

  // Prefill from existing data so this box VIEWS and EDITS the full running log,
  // not just appends — parity with the lift log. Saving replaces the series with
  // the parsed text (so edits and deletions take effect).
  const initUnits = store.profile?.units ?? 'lb';
  const initial = formatBulkLog(
    store.weighIns.map((w) => ({ date: w.date, weight: fromKg(w.weightKg, initUnits) })),
    store.calories.map((c) => ({ date: c.date, kcal: c.kcal })),
  );
  const hasExisting = initial.text !== '';

  let startDate = $state(initial.startDate || todayISO());
  let text = $state(initial.text);

  const rows = $derived(parseBulkLog(text, startDate));
  const stats = $derived(summarize(rows));
  const badLines = $derived(rows.filter((r) => r.bad));
  const canApply = $derived(stats.weighIns > 0 || stats.calorieDays > 0);

  function apply(): void {
    const w: WeighIn[] = [];
    const c: CalorieEntry[] = [];
    for (const r of rows) {
      if (r.weight !== null) w.push({ date: r.date, weightKg: toKg(r.weight, units) });
      if (r.kcal !== null) c.push({ date: r.date, kcal: r.kcal });
    }
    // Full-log editor: replace the series with exactly what's in the box.
    store.setData(w, c);
  }
</script>

<div class="card bulklog">
  <div class="row">
    <label>Start date<input type="date" bind:value={startDate} /></label>
    <span class="hint">First line = this day, then one day per line.</span>
  </div>

  <label class="full">
    {hasExisting ? `Your weight log (${units} − calories), one day per line` : `Log (${units} − calories), one day per line`}
    <textarea
      rows="8"
      bind:value={text}
      placeholder={'201.2 - 2400\n200.5 - 2400\n200.1 - 2200\nNA - NA\n199.3 - 2600'}
    ></textarea>
  </label>

  <p class="hint">
    Format <code>weight - calories</code>. Use <code>NA</code> (or leave blank) to skip a field — a
    skipped day still counts so dates stay aligned. Calories are optional.
    {#if hasExisting}<br />This is your full weight log — edit any line or append new days, then Save (replaces the series).{/if}
  </p>

  {#if text.trim() !== ''}
    <div class="preview">
      <span class="pill">{stats.weighIns} weigh-ins</span>
      <span class="pill">{stats.calorieDays} calorie days</span>
      {#if stats.from}<span class="pill muted">{stats.from} → {stats.to}</span>{/if}
      {#if stats.bad > 0}<span class="pill warn">{stats.bad} unreadable</span>{/if}
    </div>
    {#if badLines.length}
      <ul class="bad">
        {#each badLines.slice(0, 5) as b}
          <li title="couldn't read this line">“{b.raw.trim()}” → skipped</li>
        {/each}
      </ul>
    {/if}
  {/if}

  <button class="primary" disabled={!canApply} onclick={apply}>
    {#if !canApply}{hasExisting ? 'Save log' : 'Add entries'}
    {:else}{hasExisting ? `Save ${stats.weighIns} weigh-ins` : `Add ${stats.weighIns} weigh-ins`}{/if}
  </button>
</div>

<style>
  .preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.25rem 0 0.5rem;
  }
  .pill {
    font-size: 0.8rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: #eef6f5;
    color: var(--teal-d, #0a5f5e);
  }
  .pill.muted {
    background: #f1ede4;
    color: var(--ink, #1f2933);
  }
  .pill.warn {
    background: #fdeccd;
    color: #8a5a00;
  }
  .bad {
    margin: 0 0 0.5rem;
    padding-left: 1.1rem;
    color: #8a5a00;
    font-size: 0.82rem;
  }
  code {
    background: #f1ede4;
    border-radius: 4px;
    padding: 0 0.25rem;
  }
</style>
