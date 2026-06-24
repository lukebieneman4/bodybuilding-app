<script lang="ts">
  import type { Profile, Units, PaceMode } from '../data/types';
  import { toKg, fromKg, kgToLb } from '../data/types';
  import { store, todayISO } from '../data/store.svelte';

  let { initial }: { initial?: Profile | null } = $props();

  // Snapshot the prop once for prefill — this is an edit form, the profile
  // doesn't change underneath it. Reading a plain const (not the reactive prop)
  // inside the $state initializers avoids the state_referenced_locally warning.
  const seed = initial ?? null;

  let units = $state<Units>(seed?.units ?? 'lb');
  let goal = $state<number>(
    seed ? Number(fromKg(seed.goalKg, seed.units).toFixed(1)) : 185
  );
  let paceMode = $state<PaceMode>(seed?.paceMode ?? 'rate');
  let rate = $state(seed?.targetRatePctPerWeek ?? 0.5);
  let targetDate = $state(seed?.targetDate ?? '');
  let durationWeeks = $state(seed?.durationWeeks ?? 12);
  let notes = $state(seed?.notes ?? '');

  // Reference weight for the "≈ X lb/wk" helper: most recent weigh-in, else goal.
  const refKg = $derived(
    store.weighIns.length ? store.weighIns[store.weighIns.length - 1].weightKg : toKg(goal, units)
  );
  const rateLbWk = $derived(kgToLb((rate / 100) * refKg));
  const durationEndsISO = $derived.by(() => {
    const start = store.weighIns[0]?.date ?? todayISO();
    const d = new Date(start + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + Math.round(durationWeeks * 7));
    return d.toISOString().slice(0, 10);
  });

  function submit(e: Event): void {
    e.preventDefault();
    const p: Profile = {
      units,
      goalKg: toKg(goal, units),
      paceMode,
      targetRatePctPerWeek: paceMode === 'rate' ? rate : (seed?.targetRatePctPerWeek ?? 0.5),
      targetDate: paceMode === 'date' ? targetDate || undefined : undefined,
      durationWeeks: paceMode === 'duration' ? durationWeeks : undefined,
      notes: notes || undefined,
      createdAt: seed?.createdAt ?? new Date().toISOString(),
    };
    store.setProfile(p);
  }
</script>

<form class="card intake" onsubmit={submit}>
  <h2>Set up your diet phase</h2>
  <p class="hint">Keep it simple — a goal weight and how you want to pace toward it. Change anytime.</p>

  <div class="grid">
    <label>
      Units
      <select bind:value={units}>
        <option value="lb">pounds (lb)</option>
        <option value="kg">kilograms (kg)</option>
      </select>
    </label>

    <label>Goal weight ({units})<input type="number" step="0.5" bind:value={goal} /></label>
  </div>

  <fieldset class="pace">
    <legend>Pace toward goal</legend>
    <div class="seg">
      <button type="button" class:active={paceMode === 'rate'} onclick={() => (paceMode = 'rate')}>
        Rate
      </button>
      <button type="button" class:active={paceMode === 'date'} onclick={() => (paceMode = 'date')}>
        End date
      </button>
      <button
        type="button"
        class:active={paceMode === 'duration'}
        onclick={() => (paceMode = 'duration')}
      >
        Duration
      </button>
    </div>

    {#if paceMode === 'rate'}
      <label>
        Loss rate (% body weight / week)
        <input type="number" step="0.05" min="0.1" max="1.5" bind:value={rate} />
        <span class="hint">≈ {rateLbWk.toFixed(2)} {units}/wk · 0.5–0.7%/wk preserves muscle (Helms 2014)</span>
      </label>
    {:else if paceMode === 'date'}
      <label>
        Reach goal by
        <input type="date" bind:value={targetDate} />
        <span class="hint">The app works out the pace needed to hit your goal by this date.</span>
      </label>
    {:else}
      <label>
        Phase length (weeks)
        <input type="number" step="1" min="1" max="104" bind:value={durationWeeks} />
        <span class="hint">≈ ends {durationEndsISO} · pace is derived from goal + length.</span>
      </label>
    {/if}
  </fieldset>

  <label class="full">
    Notes (injuries, context — shapes recommendations)
    <textarea rows="2" bind:value={notes} placeholder="e.g. recovering from ACL surgery"></textarea>
  </label>

  <button type="submit" class="primary">Start tracking</button>
</form>

<style>
  .pace {
    border: 1px solid var(--line, #e6e1d6);
    border-radius: 10px;
    padding: 0.75rem 0.9rem 0.9rem;
    margin: 0.25rem 0 0.5rem;
  }
  .pace legend {
    padding: 0 0.4rem;
    font-size: 0.85rem;
    color: var(--muted, #6b7280);
  }
  .seg {
    display: flex;
    gap: 0;
    margin-bottom: 0.75rem;
    border: 1px solid var(--line, #e6e1d6);
    border-radius: 8px;
    overflow: hidden;
    width: fit-content;
  }
  .seg button {
    background: #fff;
    border: 0;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    color: var(--ink, #1f2933);
    border-right: 1px solid var(--line, #e6e1d6);
  }
  .seg button:last-child {
    border-right: 0;
  }
  .seg button.active {
    background: var(--teal, #0e7c7b);
    color: #fff;
  }
</style>
