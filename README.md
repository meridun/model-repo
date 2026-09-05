# model-repo

Canonical **upstream hub for shared repo configuration** across my project repos — primarily the
parts a repo uses to configure its AI agents (Claude Code / GitHub Copilot): instructions, skills,
agents, hooks, worker prompts, and the scripts that keep them in sync. It is also a GitHub template
(`is_template: true` — "Use this template", or `gh repo create my-new-project --template
meridun/model-repo`) for bootstrapping a new repo with that config.

## Role and sync workflow

Hub-and-spoke, both directions, one **component** at a time:

```
project A ──(port in: improved component)──▶ model-repo ──(migrate out)──▶ project B, C, …
```

1. A project repo makes a significant improvement to a shareable component.
2. The improvement is ported **into** model-repo, generalised on the way (project specifics →
   `<PLACEHOLDERS>`, project skill prefix → `proj-`).
3. Other project repos migrate the new or updated component **from** model-repo when convenient.

Sync is manual and ad hoc — no version negotiation. Three things keep it cheap for an agent:

- **Component inventory** (next section). The unit of comparison is a component, never the whole
  repo.
- **Provenance pins.** Each component's L3 doc carries a `> **Upstream pin:**` line. Here it names
  the external upstream, or the project repo and commit the component was last ported from; in a
  project repo it names the model-repo commit last migrated from. Diff from the pin, port, bump the
  pin. Components without an L3 doc pin in the inventory row instead.
- **[`proj-upstream-sync`](.github/skills/proj-upstream-sync/SKILL.md) skill.** The compare/port
  procedure, shipped to project repos so both sides run the same steps.

For comparison agents: model-repo holds the *generalised* form. A difference that is a project's
placeholder fill-in, prefix rename, or documented local adaptation is **not drift**; only a
substantive improvement (or a bug fix) is a port candidate.

## Component inventory

| Component | Paths here | Provenance / pin |
|---|---|---|
| Doc-tier system (L1/L2/L3) | `.github/copilot-instructions.md`, `CLAUDE.md`, `docs/Documentation.md`, `.github/skills/proj-doc-tiers/`, `.github/skills/proj-agent-skill/` | originated here |
| Config sync + meta-drift guard | `scripts/sync-claude-config.mjs`, `scripts/check-meta-drift.mjs` | ported from a project repo (script header cites its issues #454/#490); **unpinned** |
| Caveman mode hook | `.claude/settings.json` (`UserPromptSubmit`) | originated here |
| graphify nudge hook | `.claude/hooks/graphify-nudge.py`, `.claude/settings.json` (`PreToolUse`), `docs/Development_TokenTools.md` | originated here; graphify itself is external |
| Role-based model routing | `.github/agents/*.agent.md` (except `sdlc-worker`), `## Orchestration` in L1, `docs/Development_ModelRouting.md` | pilotfish **v1.1.2** — pin in `docs/Development_ModelRouting.md` |
| Agentic SDLC pipeline | `prompts/sdlc/`, `scripts/sdlc.mjs`, `test/sdlc.test.mjs`, `.github/agents/sdlc-worker.agent.md`, `docs/Development_AgenticSDLC.md`, `docs/Development_Sdlc*.md` | agentic-sdlc upstream **9161863** — pin in `docs/Development_AgenticSDLC.md` |
| Upstream sync procedure | `.github/skills/proj-upstream-sync/` | originated here |

## Bootstrapping a new repo (template use)

Generating a repo from this template gives you every component above:

1. **Documentation tier system (L1/L2/L3)** — cheap-first context loading so agents don't
   re-derive the same architecture facts every session. See
   [docs/Documentation.md](docs/Documentation.md).
2. **Token optimizer tools**:
   - **Caveman mode** — a `UserPromptSubmit` hook that keeps agent replies terse by default
     (`.claude/settings.json`).
   - **vtk** — a git/gh/npm output-filtering wrapper (bring your own binary; wiring notes in
     [docs/Development_TokenTools.md](docs/Development_TokenTools.md)).
   - **graphify** — codebase-to-knowledge-graph tool with a `PreToolUse` nudge hook
     (`.claude/hooks/graphify-nudge.py`) that steers agents to `graphify query` before raw
     grep/read once a graph exists.
3. **Role-based model routing** — six repo-committed role agents (`scout`, `Explore`,
   `mech-executor`, `executor`, `verifier`, `security-executor`) pinned to cost tiers via
   frontmatter, plus a role-only orchestration policy in L1. Adapted from
   [pilotfish](https://github.com/Nanako0129/pilotfish) (MIT), moved from global to project
   level so it ships with the repo. See
   [docs/Development_ModelRouting.md](docs/Development_ModelRouting.md).
4. **Agentic SDLC setup** — an issue-driven pipeline (`intake → design → queued → build →
   verify → audit → ship`) with a deterministic `sdlc` CLI (`scripts/sdlc.mjs`) for the
   label/branch mechanics, worker prompts in `prompts/sdlc/`, and an isolated `sdlc-worker`
   agent. Fill the `<PLACEHOLDERS>` per `docs/Development_SdlcAdoption.md` before scheduling it.

### Quick start

1. Generate a repo from this template.
2. Rename the `proj-` skill/agent prefix to your project's own (find/replace across
   `.github/skills/`, `.github/agents/`, `prompts/sdlc/`, `.github/copilot-instructions.md`,
   `scripts/check-meta-drift.mjs`).
3. Fill in `docs/Overview.md` and `docs/Architecture.md` with your actual system.
4. `npm install` then `npm run sync:claude-config` to mirror `.github/` into `.claude/`.
5. Delete anything you don't need (the SDLC pipeline in particular is opt-in — it assumes a
   GitHub Issues-driven workflow with `gh` available).

### Layout

```
.github/copilot-instructions.md   L1 — loaded every request (principles + routing)
.github/skills/*/SKILL.md         L2 — loaded on demand (detailed patterns)
docs/*.md                         L3 — loaded explicitly (deep reference)
.github/agents/*.agent.md         Subagent shims (canonical source)
.claude/                          Claude Code mirror, generated — do not hand-edit
prompts/sdlc/                     Agentic SDLC worker prompts
scripts/                          sync-claude-config, check-meta-drift, sdlc CLI
```

`.claude/skills/` and `.claude/agents/` are generated by `npm run sync:claude-config` from the
`.github/` sources — never hand-edit them.
