# Copilot Instructions

## Core Principles

- **Ask when unclear, flag uncertainty** — never make silent assumptions about intent or
  architecture; say so when confidence is low.
- **Minimal change** — simplest thing that works; reuse and extend existing code; don't touch
  unrelated files even to "improve" them.
- **Follow existing patterns** — consistency over novelty; find a similar implementation before
  inventing one.
- **Test everything changed** — code edits need test updates; run targeted tests, full suite only
  on request or pre-merge.
- **No git operations** unless explicitly requested.
- **Git flow** — `{feature} → dev → main`. All work happens on feature branches cut from `dev`
  (the default/integration branch). `main`/`master` is prod: never branch from, checkout, or merge
  to it unless explicitly requested. Adjust to your repo's actual branch model.

## Memory vs Documentation

- Claude Code: use its own `~/.claude` memory for fresh or uncertain lessons. Copilot: use
  `/memories/` (workspace-local, not version-controlled).
- Promote to L3 docs once verified, broadly applicable, and useful to humans — then shorten the
  memory entry to a pointer.

## Documentation Tiers

- **L1** (this file) — loaded every request. Principles + routing only. Keep ≤100 lines.
- **L2** (`.github/skills/*/SKILL.md`) — auto-loaded when task matches skill description.
  Detailed patterns. Keep ≤400 lines.
- **L3** (`docs/`) — read explicitly when needed. Architecture, deep reference. Unlimited.

The skill list and agent list are auto-injected into every request — do not duplicate them here.
Match task to skill description and load it before implementing.

L3 entry points: [Overview.md](../docs/Overview.md), [Architecture.md](../docs/Architecture.md),
[Documentation.md](../docs/Documentation.md).

## Compound Tasks (load skills sequentially, not all at once)

Add rows here as your project grows multi-skill build sequences, e.g.:

| Task | Skill sequence |
|---|---|
| Session-end knowledge harvest / doc-tier audit | `proj-doc-tiers` → `proj-agent-skill` |

## Tone

Professional and concise.

## Caveman mode

Drop filler: no preambles, no restated questions, no trailing summaries unless asked. Keep code,
paths, error messages, and technical accuracy intact — terseness never trims correctness.
Exception: security warnings, irreversible actions, and ambiguous multi-step plans get full
sentences; resume terse mode after. Wired as a `UserPromptSubmit` hook in
`.claude/settings.json` for Claude Code; for Copilot, restate this instruction at the top of a
session if it drifts.

## graphify

Once `graphify-out/graph.json` exists (see [graphify](https://github.com/anthropics)), it's your
**first** action for any architecture / structure / "how do I…, where is…, what does…" question —
before grep or raw reads. It returns a scoped subgraph, usually far smaller than raw output.

- `graphify query "<question>"` — scoped subgraph for how/where/what; `graphify path "<A>" "<B>"`
  for relationships; `graphify explain "<concept>"` for a focused concept.
- Read source files only to modify/debug specific code, when the graph lacks detail, or when it's
  stale.

## Token wrappers

If you adopt `vtk` (output-filtering wrapper for `git`/`gh`/your package manager — see
`docs/Development_TokenTools.md`), document the exact routing rule here (which commands are
auto-wrapped via shell profile vs. need an explicit prefix) so both Copilot and Claude Code know
not to double-wrap.
