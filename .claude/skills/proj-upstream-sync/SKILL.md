---
name: proj-upstream-sync
description: Compare, port, and pin shared repo-config components between a project repo and the model-repo upstream hub (instructions, skills, agents, hooks, SDLC prompts, sync scripts). Use when asked to "sync with model-repo", "port this improvement upstream", "migrate the latest X from model-repo", or to audit a repo's shared config for drift against upstream.
---

# proj-upstream-sync

The compare/port procedure for shared repo configuration. `meridun/model-repo` is the **hub**:
project repos port significant improvements **into** it (generalised), and other project repos
migrate components **out** of it. Both sides run this same skill, so the steps are symmetric.

## When to Use

- Porting an improvement made in a project repo up to model-repo.
- Migrating a new or updated component from model-repo into a project repo.
- Auditing "what has drifted between this repo and model-repo?" without changing anything.
- Recording or bumping an upstream pin after a port.

## When NOT to Use

- Editing a component for this repo only, with no intent to share — normal editing rules apply.
- Syncing `.github/` → `.claude/` inside one repo — that is `npm run sync:claude-config`, covered
  by [proj-agent-skill](../proj-agent-skill/SKILL.md).
- External upstreams (pilotfish, graphify, agentic-sdlc) — same pin format, but the re-sync
  instructions live in the component's own L3 doc; follow those.

## Vocabulary

- **Component** — the unit of comparison. The authoritative list is the **Component inventory**
  table in model-repo's `README.md`: name, owned paths, provenance. Never diff whole repos.
- **Pin** — a `> **Upstream pin:**` blockquote near the top of the component's L3 doc recording
  what the component was last synced against. Components with no L3 doc pin in the inventory row.
- **Generalised form** — what model-repo holds: `<PLACEHOLDERS>` for project specifics, `proj-`
  as the skill/agent prefix, no project names, paths, or commands.
- **Local adaptation** — a deliberate project-side deviation, named in the project's pin so the
  next sync preserves it instead of flagging it.

## Pin format

```markdown
> **Upstream pin:** <source> **<version or short sha>** (<YYYY-MM-DD>). To re-sync, diff
> <their paths> against <our paths>, then bump this pin. Local adaptations to preserve: <list, or "none">.
```

- In **model-repo**, `<source>` is the external upstream or the project repo the component was
  last ported *from* (e.g. `meridun/acme-app`).
- In a **project repo**, `<source>` is `meridun/model-repo`.
- Use the short sha of the source commit that contains the synced state, not the porting commit.

## Procedure

### 0. Locate

1. Read model-repo's `README.md` **Component inventory**. Identify the component and its owned
   paths on both sides (project paths differ by prefix rename and any documented relocation).
2. Read both pins. If a side has none, the baseline is "unknown": treat every difference as a
   candidate and record a pin at the end regardless of outcome.

### 1. Compare (all modes)

1. Diff component paths only, from the pinned commit on the source side to its current HEAD, and
   against the destination's current files. Fetch the source into a scratch checkout or use
   `gh api`/`git show` — do **not** add it as a remote of the destination repo.
2. Classify each difference before touching anything:

| Class | Example | Action |
|---|---|---|
| Fill-in | `<TEST_CMD>` → `npm test`; `proj-` → `acme-` | ignore |
| Local adaptation (named in pin) | `PROD_BRANCH=main`; CLI relocated to `scripts/` | preserve, ignore |
| Improvement | new rule, new lane, clearer prompt, bug fix, new test | port |
| Undocumented divergence | a rule dropped on one side with no rationale | ask; do not resolve silently |

3. Report the table to the user before porting. Audit-only mode ends here.

### 2. Port in (project → model-repo)

1. Branch from `dev` in model-repo (`feat/port-<component>-<project>`).
2. Apply only **Improvement** rows. Generalise on the way: project specifics → `<PLACEHOLDERS>`
   (add new ones to `docs/Development_SdlcAdoption.md` if SDLC), prefix → `proj-`, drop project
   names and paths.
3. Update the component's L3 doc pin (`<source>` = the project repo, sha = its HEAD) and the
   inventory row if paths changed.
4. Run `npm run sync:claude-config`, `npm run check:meta-drift`, `npm test`.
5. Commit message: `feat(<component>): port <what> from <project>@<sha>`.

### 3. Migrate out (model-repo → project)

1. Branch from the project's integration branch.
2. Apply only **Improvement** rows, re-applying the project's fill-ins and local adaptations.
3. Update the project-side pin (`<source>` = `meridun/model-repo`, sha = model-repo HEAD).
4. Run the project's equivalents of sync, drift check, and tests.
5. Commit message: `chore(<component>): migrate <what> from model-repo@<sha>`.

### 4. Both directions

A port frequently reveals improvements flowing the other way. Finish one direction, pin, then
start the other as a separate change — never mix directions in one commit.

## Gotchas

- **Prefix rename hides real diffs.** Normalise `proj-`/`<prefix>-` before diffing, or every
  skill reference reads as changed.
- **`.claude/` is generated.** Never diff or port `.claude/skills/` or `.claude/agents/`; diff the
  `.github/` sources and regenerate.
- **A pin in a commit message is not a pin.** The SDLC port originally recorded its sha only in
  the porting commit and was invisible to later comparison passes. Put it in the doc.
- **L1 line budget.** `copilot-instructions.md` is capped at ~100 lines; porting a rule into L1
  may require demoting something to L2 first.

## References

- model-repo `README.md` — role, sync workflow, component inventory
- [proj-agent-skill](../proj-agent-skill/SKILL.md) — skill authoring, `sync:claude-config`,
  meta-drift guard
- [proj-doc-tiers](../proj-doc-tiers/SKILL.md) — where ported knowledge belongs (L1/L2/L3)
- `docs/Development_ModelRouting.md`, `docs/Development_AgenticSDLC.md` — existing pins to imitate
