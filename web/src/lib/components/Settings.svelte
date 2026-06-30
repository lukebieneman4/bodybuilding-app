<script lang="ts">
  import { store } from '../data/store.svelte';
  import { PROTEIN_GUIDANCE, PROTEIN_DEFAULT_G_PER_KG } from '../core/protein';

  const s = $derived(store.settings);
  const guide = $derived(PROTEIN_GUIDANCE[s.proteinBasis]);

  function setBasis(basis: 'bodyweight' | 'leanmass'): void {
    store.setSetting('proteinBasis', basis);
    store.setSetting('proteinTargetGPerKg', PROTEIN_DEFAULT_G_PER_KG[basis]); // basis-appropriate default
  }
</script>

<section class="card prefs">
  <div class="cardhead">
    <h2>Preferences</h2>
    <span class="hint">Turn coaching features on or off — hide anything you don't want.</span>
  </div>

  <label class="toggle">
    <span class="txt">
      <b>Track protein</b>
      <small>Log protein in the paste box and see daily adherence vs your target.</small>
    </span>
    <input
      type="checkbox"
      role="switch"
      checked={s.trackProtein}
      onchange={(e) => store.setSetting('trackProtein', e.currentTarget.checked)}
    />
  </label>

  {#if s.trackProtein}
    <div class="field">
      <span>Target basis</span>
      <div class="seg">
        <button class:on={s.proteinBasis === 'bodyweight'} onclick={() => setBasis('bodyweight')}>Bodyweight</button>
        <button class:on={s.proteinBasis === 'leanmass'} onclick={() => setBasis('leanmass')}>Lean mass</button>
      </div>
    </div>

    <label class="field">
      <span>Protein target <small>g per kg {s.proteinBasis === 'leanmass' ? 'fat-free mass' : 'bodyweight'}</small></span>
      <input
        type="number"
        min="1"
        max="4"
        step="0.1"
        value={s.proteinTargetGPerKg}
        onchange={(e) => store.setSetting('proteinTargetGPerKg', +e.currentTarget.value)}
      />
    </label>

    {#if s.proteinBasis === 'leanmass'}
      <label class="field">
        <span>Body fat % <small>needed for lean mass; else falls back to bodyweight</small></span>
        <input
          type="number"
          min="3"
          max="60"
          step="0.5"
          value={s.bodyFatPct ?? ''}
          placeholder="—"
          onchange={(e) => store.setSetting('bodyFatPct', e.currentTarget.value ? +e.currentTarget.value : undefined)}
        />
      </label>
    {/if}

    <p class="hint">Recommended {guide.lo}–{guide.hi} g/kg ({guide.cite}).</p>
  {/if}
</section>

<style>
  .prefs { display: flex; flex-direction: column; gap: 4px; }
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 0;
    cursor: pointer;
    font-weight: 400;
  }
  .toggle + :global(.field) { border-top: 1px solid #f0ece3; }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  .txt b { font-size: 14px; color: var(--ink, #1f2933); }
  .txt small { font-size: 12px; color: var(--sub, #6b7280); line-height: 1.4; }

  /* switch */
  input[type='checkbox'][role='switch'] {
    appearance: none;
    -webkit-appearance: none;
    flex: 0 0 auto;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: #d8d2c6;
    border: none;
    position: relative;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  input[type='checkbox'][role='switch']::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease;
  }
  input[type='checkbox'][role='switch']:checked { background: var(--teal, #0e7c7b); }
  input[type='checkbox'][role='switch']:checked::after { transform: translateX(18px); }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 0 4px;
    font-weight: 400;
  }
  .field span { display: flex; flex-direction: column; gap: 2px; font-size: 14px; color: var(--ink, #1f2933); }
  .field small { font-size: 12px; color: var(--sub, #6b7280); font-weight: 400; }
  .field input { width: 84px; }

  .seg { display: inline-flex; gap: 3px; background: #f1ede4; border: 1px solid var(--line, #e7e2d8); border-radius: 9px; padding: 3px; }
  .seg button {
    background: transparent;
    border: none;
    color: var(--sub, #6b7280);
    font-size: 12.5px;
    font-weight: 600;
    padding: 5px 11px;
    border-radius: 6px;
    cursor: pointer;
  }
  .seg button.on { background: #fff; color: var(--ink, #1f2933); box-shadow: 0 1px 2px rgba(31, 41, 51, 0.06); }
</style>
