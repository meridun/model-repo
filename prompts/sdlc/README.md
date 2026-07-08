# SDLC worker prompts

Executable artifacts (not reference docs) for an issue-driven **Agentic SDLC pipeline**: a chain
of subagent "workers", one per pipeline stage, each doing one pass over one GitHub issue and then
stopping. State lives entirely on the issue (labels + comments) — workers share no context with
each other or with whatever dispatched them.

This is a **template** — fill in the project name, adjust the stage list, and replace the
`proj-*` skill/agent names with your own before relying on it.

## Stage graph

```
intake → design → queued → build → verify → audit → ship
```

- `stage:<lane>` labels track position in the pipeline.
- `sdlc:wip` is the per-item lock a worker sets on CLAIM and clears on EMIT.
- `sdlc:needs-human` parks an item for a human decision; `sdlc:hold` is a human keep-off flag.
  Workers never touch either.
- `stage:queued` is intentionally workerless — the human throttle between design and build.

The deterministic label/branch mechanics (claim, advance, context, worktree) have one-shots in
[`scripts/sdlc.mjs`](../../scripts/sdlc.mjs) (`npm run sdlc claim|advance|context|worktree`) —
`advance` validates the transition against the stage graph so illegal jumps and label typos are
rejected by construction. Comment/report **bodies** stay agent judgment; `sdlc comment` is a thin
plumbing wrapper that posts a body the agent already authored.

## How to run

- **Scheduled**: a dispatcher (see [`dispatch.md`](dispatch.md)) runs periodically: a wip-lock
  gate (abort on a fresh lock, reap a stale one), then one worker subagent per non-empty lane,
  serially, in pipeline order.
- **Manual**: paste this README plus a lane file's body into an agent session. Identical
  behavior — the prompt doesn't know what fired it.

## Universal worker loop (binding)

1. **CLAIM** — list open issues labeled `stage:<lane>` that are **not** labeled `sdlc:wip`,
   `sdlc:needs-human`, or `sdlc:hold`. Pick the next by priority then FIFO. If none → reply
   `<LANE>: idle` and stop. Add `sdlc:wip` **before** doing anything else — it is the lock.
2. **WORK** — per the lane file, with these constraints:
   - **Never delegate** — do all work inline, yourself. Don't spawn subagents or background
     tasks; a scheduled worker that yields mid-task strands the item under `sdlc:wip` forever.
   - **Idempotent** — if the stage's artifact already exists, treat as done; don't redo it.
   - **Tree hygiene** — record the entry branch before any switch and restore it before EMIT.
     Never touch the production branch. Never stash/discard uncommitted human work.
   - If a codebase knowledge graph exists (e.g. `graphify-out/graph.json`), query it before
     reading raw source.
3. **EMIT exactly one outcome** — ADVANCE, BOUNCE, or PARK — never silent. Every outcome removes
   `sdlc:wip` on the way out.
4. **STOP** — reply the lane's one-line result. One item per pass; never pick up a second.

## Files

| File | Stage | Notes |
|---|---|---|
| [`dispatch.md`](dispatch.md) | *(dispatcher)* | Runs every lane once per cycle |
| [`intake.md`](intake.md) | `stage:intake` → `stage:design` or `stage:queued` | Triage: coherent, in scope, non-dup |
| [`design.md`](design.md) | `stage:design` → `stage:queued` | Settle UX/approach before build |
| [`build.md`](build.md) | `stage:build` → `stage:verify` | Implement |
| [`verify.md`](verify.md) | `stage:verify` → `stage:audit` | Tests + a real run |
| [`audit.md`](audit.md) | `stage:audit` → `stage:ship` | Review for correctness/security |
| [`ship.md`](ship.md) | `stage:ship` → *(closed on merge)* | Open the PR, update docs |

Fill in each lane file's specifics for your project — the ones in this directory are minimal
templates showing the shape, not production-ready prompts.
