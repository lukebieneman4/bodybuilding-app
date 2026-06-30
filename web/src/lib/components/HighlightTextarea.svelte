<script lang="ts">
  /**
   * A textarea that draws colored wavy underlines under specific (whole) lines —
   * the classic "highlight overlay" technique: a transparent-text mirror sits
   * exactly behind a transparent-background textarea, so the user types in the
   * textarea while the mirror's decorations show through, perfectly aligned.
   * Marks are line-based (0-based), matching how our parsers report problems.
   */
  // error = red wavy (skipped); warn = amber wavy (verify); note = amber dotted
  // (a soft data-quality nudge, e.g. a Uni lift missing its L/R split).
  export type MarkKind = 'error' | 'warn' | 'note';

  let {
    value = $bindable(''),
    marks = [],
    rows = 8,
    placeholder = '',
    ariaLabel = '',
  }: {
    value?: string;
    marks?: { line: number; kind: MarkKind }[];
    rows?: number;
    placeholder?: string;
    ariaLabel?: string;
  } = $props();

  let ta = $state<HTMLTextAreaElement>();
  let backdrop = $state<HTMLDivElement>();

  // textarea.value normalizes line breaks to \n, so a plain split keeps the
  // mirror's line indices in lock-step with the parsers' (which use /\r?\n/).
  const lines = $derived(value.split('\n'));
  const kindByLine = $derived(new Map(marks.map((m) => [m.line, m.kind])));

  function sync(): void {
    if (backdrop && ta) {
      backdrop.scrollTop = ta.scrollTop;
      backdrop.scrollLeft = ta.scrollLeft;
    }
  }
  // keep the backdrop aligned when the value changes programmatically too
  $effect(() => {
    void value;
    sync();
  });
</script>

<div class="htx">
  <div class="backdrop" bind:this={backdrop} aria-hidden="true">
    <div class="mirror">{#each lines as ln, i}<span
          class:error={kindByLine.get(i) === 'error'}
          class:warn={kindByLine.get(i) === 'warn'}
          class:note={kindByLine.get(i) === 'note'}>{ln || ' '}</span>{#if i < lines.length - 1}{'\n'}{/if}{/each}</div>
  </div>
  <textarea
    bind:this={ta}
    bind:value
    {rows}
    {placeholder}
    aria-label={ariaLabel}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    oninput={sync}
    onscroll={sync}
  ></textarea>
</div>

<style>
  .htx { position: relative; }

  /* The mirror and textarea MUST share every text-metric property so wrapping
     and caret position line up exactly. */
  .backdrop,
  .htx textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    line-height: 1.5;
    padding: 12px;
    border: 1px solid transparent;
    border-radius: 10px;
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
    letter-spacing: normal;
    tab-size: 4;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    overflow: auto;
    color: transparent;
    pointer-events: none;
    z-index: 0;
  }
  .mirror { min-height: 100%; }

  .mirror span.error {
    text-decoration: underline wavy #c0392b;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 2px;
  }
  .mirror span.warn {
    text-decoration: underline wavy #b4690e;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 2px;
  }
  .mirror span.note {
    text-decoration: underline dotted #d3a45e;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

  .htx textarea {
    position: relative;
    z-index: 1;
    display: block;
    background: transparent;
    border-color: var(--line, #e3ddd0);
    color: var(--ink, #1f2933);
    resize: vertical;
  }
  .htx textarea:focus {
    outline: 2px solid color-mix(in srgb, var(--teal, #0e7c7b) 35%, transparent);
    border-color: var(--teal, #0e7c7b);
  }
</style>
