# Development_AgenticSDLC.md

If you adopt the `prompts/sdlc/` pipeline (see [prompts/sdlc/README.md](../prompts/sdlc/README.md)
for the stage graph and worker loop), document here:

- How the dispatcher is scheduled (cron, CI, Claude Code scheduled task) and its cadence.
- The `sdlc` CLI one-shots (`npm run sdlc claim|advance|context|worktree|comment`) — see
  [scripts/sdlc.mjs](../scripts/sdlc.mjs) for the stage graph and command reference.
- Any project-specific bounce/park rules beyond the generic lane templates.
- What's been proven to actually work end-to-end vs. what's still untested, so future changes
  know which tails are load-bearing.

This file is intentionally a stub in the template — fill it in once the pipeline is running
against real issues.
