<script lang="ts">
  import { parseWorkoutLog } from '../lift/parser';
  import { assignCadenceDates } from '../lift/dates';
  import { SAMPLE_LOG } from '../lift/sample';
  import { store, todayISO } from '../data/store.svelte';

  let { ondone }: { ondone?: () => void } = $props();

  let text = $state('');
  let startDate = $state(todayISO());

  const parsed = $derived(text.trim() ? parseWorkoutLog(text) : null);
  const totalExercises = $derived(
    parsed ? parsed.sessions.reduce((n, s) => n + s.exercises.length, 0) : 0
  );
  const flaggedCount = $derived(
    parsed ? parsed.sessions.reduce((n, s) => n + s.exercises.filter((e) => e.flagged).length, 0) : 0
  );

  function save(): void {
    if (!parsed || parsed.sessions.length === 0) return;
    const dated = assignCadenceDates(parsed.sessions, startDate);
    store.setLiftSessions(dated);
    text = '';
    ondone?.();
  }
</script>

<section class="card import">
  <h2>Import your training log</h2>
  <p class="hint">
    Paste your workout notes exactly as you log them — one exercise per line, sessions starting with a
    title line ending in “:”. Nothing is saved until you review the preview and hit Import.
  </p>

  <textarea
    bind:value={text}
    rows="10"
    placeholder={'Anterior Brick:\nUni Machine Side Delt (5) 170- 10.0\nPec Deck (5, 1) 308- 11.0\n...'}
  ></textarea>
  {#if !text.trim()}
    <button class="ghost sample" onclick={() => (text = SAMPLE_LOG)}>Load my training log</button>
  {/if}

  {#if parsed}
    <div class="preview">
      <div class="stats">
        <span class="stat"><b>{parsed.sessions.length}</b> sessions</span>
        <span class="stat"><b>{totalExercises}</b> exercises</span>
        <span class="stat" class:warn={flaggedCount > 0}><b>{flaggedCount}</b> to verify</span>
        <span class="stat" class:warn={parsed.unparsed.length > 0}>
          <b>{parsed.unparsed.length}</b> skipped lines
        </span>
      </div>

      <ul class="sessions">
        {#each parsed.sessions as s}
          <li>
            <span class="title">{s.title || '(untitled)'}</span>
            {#if s.location}<span class="loc">{s.location}</span>{/if}
            <span class="count">{s.exercises.length} lifts</span>
            {#each s.exercises.filter((e) => e.flagged) as e}
              <span class="badge" title={e.note}>⚠ {e.rawName}</span>
            {/each}
          </li>
        {/each}
      </ul>

      {#if parsed.unparsed.length}
        <p class="hint skipped">Skipped (not a recognized exercise line): {parsed.unparsed.map((u) => u.text).join(' · ')}</p>
      {/if}

      <div class="row">
        <label>Start date (first session)<input type="date" bind:value={startDate} /></label>
        <span class="hint">Sessions are spaced by your cadence (FBEOD every other day; Ant/Post 2-on-1-off).</span>
      </div>

      <button class="primary" onclick={save} disabled={parsed.sessions.length === 0}>
        Import {parsed.sessions.length} sessions
      </button>
    </div>
  {/if}
</section>

<style>
  .import textarea {
    width: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    line-height: 1.5;
    padding: 12px;
    border: 1px solid var(--line, #E3DDD0);
    border-radius: 10px;
    resize: vertical;
    box-sizing: border-box;
  }
  .preview {
    margin-top: 14px;
  }
  .stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .stat {
    font-size: 13px;
    color: var(--sub, #6B7280);
  }
  .stat b {
    color: var(--ink, #1F2933);
    font-size: 16px;
  }
  .stat.warn b {
    color: #B4690E;
  }
  .sessions {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    max-height: 220px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sessions li {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 13px;
    padding: 4px 0;
    border-bottom: 1px solid #F0ECE3;
  }
  .title {
    font-weight: 600;
    color: var(--ink, #1F2933);
  }
  .loc {
    font-size: 11px;
    background: #EAF2F1;
    color: #0E7C7B;
    padding: 1px 7px;
    border-radius: 999px;
  }
  .count {
    font-size: 12px;
    color: var(--sub, #6B7280);
  }
  .badge {
    font-size: 11px;
    color: #B4690E;
  }
  .skipped {
    font-size: 11.5px;
  }
</style>
