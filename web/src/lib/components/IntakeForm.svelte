<script lang="ts">
  import type { Profile, Units } from '../data/types';
  import { toKg } from '../data/types';
  import { store } from '../data/store.svelte';

  let { initial }: { initial?: Profile | null } = $props();

  // Prefilled with Lukas's intake (the kind of info an AI-coach intake captures).
  const seedCm = initial?.heightCm ?? 183;
  let units = $state<Units>(initial?.units ?? 'lb');
  let heightFt = $state(Math.floor(seedCm / 2.54 / 12));
  let heightIn = $state(Math.round((seedCm / 2.54) % 12));
  let heightCm = $state(seedCm);
  let goal = $state(187); // mid of 185–190
  let goalLow = $state(185);
  let goalHigh = $state(190);
  let rate = $state(initial?.targetRatePctPerWeek ?? 0.5); // conservative (ACL recovery)
  let targetDate = $state(initial?.targetDate ?? '');
  let intake = $state(initial?.currentIntakeKcal ?? 3000);
  let notes = $state(
    initial?.notes ?? 'Recovering from ACL surgery — keep the rate of loss conservative.'
  );

  function submit(e: Event): void {
    e.preventDefault();
    const cm = units === 'lb' ? Math.round((heightFt * 12 + heightIn) * 2.54) : heightCm;
    const p: Profile = {
      heightCm: cm,
      units,
      goalKg: toKg(goal, units),
      goalLowKg: toKg(goalLow, units),
      goalHighKg: toKg(goalHigh, units),
      targetRatePctPerWeek: rate,
      targetDate: targetDate || undefined,
      currentIntakeKcal: intake || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };
    store.setProfile(p);
  }
</script>

<form class="card intake" onsubmit={submit}>
  <h2>Set up your diet phase</h2>
  <p class="hint">
    This is your profile — the kind of context a coach would ask for up front. You can change it
    anytime.
  </p>

  <div class="grid">
    <label>
      Units
      <select bind:value={units}>
        <option value="lb">pounds (lb)</option>
        <option value="kg">kilograms (kg)</option>
      </select>
    </label>

    {#if units === 'lb'}
      <label>
        Height
        <span class="inline">
          <input type="number" bind:value={heightFt} min="3" max="8" /> ft
          <input type="number" bind:value={heightIn} min="0" max="11" /> in
        </span>
      </label>
    {:else}
      <label>Height (cm)<input type="number" bind:value={heightCm} min="120" max="230" /></label>
    {/if}

    <label>Goal weight ({units})<input type="number" step="0.5" bind:value={goal} /></label>
    <label>
      Goal range ({units})
      <span class="inline">
        <input type="number" step="0.5" bind:value={goalLow} /> –
        <input type="number" step="0.5" bind:value={goalHigh} />
      </span>
    </label>

    <label>
      Target loss rate (%body weight / week)
      <input type="number" step="0.05" min="0.1" max="1.5" bind:value={rate} />
      <span class="hint">0.5 %/wk ≈ {units === 'lb' ? '~1 lb' : '~0.5 kg'}/wk · conservative end recommended while recovering</span>
    </label>

    <label>Target date (optional)<input type="date" bind:value={targetDate} /></label>
    <label>Current intake (kcal/day)<input type="number" step="50" bind:value={intake} /></label>
  </div>

  <label class="full">
    Notes (injuries, context — shapes recommendations)
    <textarea rows="2" bind:value={notes}></textarea>
  </label>

  <button type="submit" class="primary">Start tracking</button>
</form>
