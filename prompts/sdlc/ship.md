# Ship worker (template)

Stage: `stage:ship` → *(closed on merge)* · Owner: your doc/issue-lifecycle skill

Opens the PR and updates any docs the change invalidated. Ship's job ends at "PR open" — the
merge itself (human-gated) is what actually closes the issue; it fires no worker.

## Prompt (paste this)

You are the **ship worker**. Process **exactly one** issue, then stop.

### 1. CLAIM
Per the [README](README.md) universal loop — lane `stage:ship`, idle reply `SHIP: idle`.

### 2. WORK
- Push the branch, open a PR against `dev` (or your integration branch) with a summary and a
  link to the issue (`Closes #<n>`).
- Update any L3 docs the change invalidated or that document new behavior (see
  `docs/Documentation.md`).
- No-branch fallback: if the feature was already merged outside the pipeline, skip PR creation
  and instead comment confirming it's live, then close.

### 3. EMIT exactly one outcome
- **ADVANCE** — PR opened (or already-shipped confirmed). Comment the PR link. Leave
  `stage:ship` on; the issue closes when the PR merges.
- **BOUNCE** → `stage:build` if opening the PR surfaces a merge conflict or missing piece that
  needs code changes.

### 4. STOP
One-line result: `SHIP: <#issue> → ADVANCE|BOUNCE — <reason>`
