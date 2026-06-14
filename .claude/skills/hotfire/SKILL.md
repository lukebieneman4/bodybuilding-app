---
name: hotfire
description: Toggle Hotfire autonomous mode for this project. Use when the user types /hotfire on, /hotfire off, or /hotfire status. Hotfire grants broad permissions (prompts only for internet downloads and out-of-project deletions) in exchange for stricter self-review and a usage-budgeted stop.
---

# Hotfire mode

Hotfire is this project's autonomous work mode — named for the engine test
where you run at full thrust under instrumentation and review the data
afterward.

## Toggling

The switch is `permissions.defaultMode` in `.claude/settings.local.json`.

- **`/hotfire on`**: set `"defaultMode": "dontAsk"` inside the `permissions`
  object (Edit the file; preserve everything else in it). Then confirm to the
  user that Hotfire is active and restate the contract below in two sentences.
- **`/hotfire off`**: set `"defaultMode": "default"`. Confirm deactivation and
  give a one-paragraph debrief of what was done while it was active (commits,
  tests, open items).
- **`/hotfire status`**: read the file and report which mode is set, plus
  current session usage posture if known.

With `dontAsk` active, everything runs without prompting EXCEPT the
`permissions.ask` rules (internet downloads: curl/wget/npm/npx/brew/git
clone/pod/gem) and the PreToolUse guard in
`.claude/hooks/check_rm_scope.py`, which forces a prompt for any `rm`
resolving outside the project. Do not weaken either list while Hotfire is
active; genuine decisions that need the user's input (scope changes,
destructive trade-offs) still go to AskUserQuestion.

## Contract while Hotfire is active

These are binding obligations, not suggestions — the user is explicitly NOT
reviewing in real time, so the review burden moves onto you:

1. **Stricter review.** Every milestone-sized diff gets a review BEFORE its
   commit — the verification-engineer agent for any algorithm/math change, and
   `/code-review` at medium+ effort for the diff — and findings rated
   wrong/fragile get fixed, not noted. The full `swift test` suite must pass
   before every commit (and the app target must build once Xcode is
   available). Every new or changed visualization is rendered and visually
   inspected (until Xcode/simulator exists, its design spec and preview code
   are reviewed instead). New algorithm or physiology math requires a
   verification test against synthetic ground truth or a literature value, and
   any new science default requires a cited source — no exceptions in this
   mode.
2. **Checkpoint commits are pre-authorized.** Commit at each verified
   milestone boundary with a descriptive message. Never leave more than one
   milestone of work uncommitted.
3. **Usage budget — stop at roughly 20% remaining.** Plan-level usage is not
   precisely measurable from inside the session, so use these proxies, in
   order of authority: any harness/system warning about approaching session
   or usage limits counts as the 20% signal; absent warnings, treat the
   second context auto-compaction as the signal. When the signal arrives:
   finish ONLY the in-progress todo item, run the full suite, commit, update
   ROADMAP.md status, and end the turn with a handoff report (what was done,
   what was verified, exact next step). Do not start new milestones after the
   signal. The remaining ~20% is reserved for the user's manual review.
4. **Handoff quality.** The end-of-run report must be readable cold: lead
   with outcomes, list commits made, name anything skipped or uncertain, and
   state the single best next action.
