<script lang="ts">
  import { parseWorkoutLog } from '../lift/parser';
  import { assignCadenceDates } from '../lift/dates';
  import { SAMPLE_LOG } from '../lift/sample';
  import { store, todayISO } from '../data/store.svelte';

  let { ondone }: { ondone?: () => void } = $props();

  // The saved log is the source of truth: prefill it so this view is also the
  // editor. Add new sessions by appending lines; charts re-derive on save.
  let text = $state(store.liftLog);
  const editingExisting = store.liftLog.trim() !== '';
  // Anchor the most-recent session to this date (default today / last used), so
  // the charts end at "now". Earlier sessions are spaced backward by cadence.
  let endDate = $state(store.liftLogEndDate || todayISO());

  const parsed = $derived(text.trim() ? parseWorkoutLog(text) : null);
  const totalExercises = $derived(
    parsed ? parsed.sessions.reduce((n, s) => n + s.exercises.length, 0) : 0
  );
  const flaggedCount = $derived(
    parsed ? parsed.sessions.reduce((n, s) => n + s.exercises.filter((e) => e.flagged).length, 0) : 0
  );

  // Cadence-resolved sessions, plus an editable per-session date override list.
  // `dates` re-seeds whenever the cadence result changes (text / anchor edits);
  // editing a single field overrides just that session's date.
  const dated = $derived(parsed ? assignCadenceDates(parsed.sessions, endDate) : []);
  let dates = $state<string[]>([]);
  $effect(() => {
    dates = dated.map((d) => d.date ?? '');
  });

  function save(): void {
    if (!parsed || parsed.sessions.length === 0) return;
    const sessions = dated.map((s, i) => ({ ...s, date: dates[i] || s.date }));
    store.setLiftLog(text, endDate, sessions);
    ondone?.();
  }
</script>

<section class="card import">
  <h2>{editingExisting ? 'Your training log' : 'Import your training log'}</h2>
  <p class="hint">
    {editingExisting
      ? 'Edit any line, or append new sessions at the bottom — this is your full running log. Nothing is saved until you review the preview and hit Save.'
      : 'Paste your workout notes exactly as you log them — one exercise per line, sessions starting with a title line ending in “:”. Nothing is saved until you review the preview and hit Import.'}
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
        {#each parsed.sessions as s, i}
          <li>
            <input type="date" class="sdate" bind:value={dates[i]} aria-label="date for {s.title || 'session'}" />
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
        <label>Most recent session<input type="date" bind:value={endDate} /></label>
        <span class="hint">Your latest session lands on this date (default today); earlier ones are spaced backward by cadence (FBEOD every other day; Ant/Post 2-on-1-off). Override any individual date above.</span>
      </div>

      <button class="primary" onclick={save} disabled={parsed.sessions.length === 0}>
        Save {parsed.sessions.length} sessions
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
  .sdate {
    font-size: 11px;
    padding: 1px 4px;
    border: 1px solid var(--line, #E3DDD0);
    border-radius: 6px;
    color: var(--sub, #6B7280);
    background: #FBFAF7;
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
