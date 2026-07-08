#!/usr/bin/env node
/**
 * `sdlc` — deterministic one-shots for the Agentic SDLC pipeline's issue
 * state-machine ritual (issue #609). The dbmate analog for our pipeline: the
 * stage graph *is* a schema, so transitions are validated against it and the
 * hand-typed `stage:verify`/`stage:audit` typo class is killed by construction.
 *
 * Only deterministic label/branch math lives here. Report and comment *bodies*
 * stay judgment (the agent writes them); `sdlc comment` is a thin plumbing
 * wrapper that posts a body the agent already authored to a file.
 *
 * Commands:
 *   sdlc claim   <issue>              add sdlc:wip, print branch + working-tree status
 *   sdlc advance <issue> <to-stage>   validate transition, swap stage label, drop sdlc:wip
 *   sdlc context <issue>              branch + status + issue labels/state + open PRs for branch
 *   sdlc worktree <issue> [<branch>]  add a sibling git worktree for the issue's branch
 *   sdlc comment <issue> <file>       post a body-file comment (plumbing only)
 *
 * The stage graph (forward pipeline edges + the documented bounces):
 *   intake → design → queued → build → verify → audit → ship
 * with `sdlc:wip` as the machine lock and `sdlc:needs-human` / `sdlc:hold` as
 * parks (see prompts/sdlc/README.md).
 *
 * Usage:
 *   node scripts/sdlc.mjs <command> [args...]
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export const WIP_LABEL = 'sdlc:wip';

/** Ordered pipeline stages. */
export const STAGES = ['intake', 'design', 'queued', 'build', 'verify', 'audit', 'ship'];

/**
 * Legal stage transitions: the forward pipeline edge(s) plus the documented
 * bounces from prompts/sdlc/. `ship` is terminal (the ship worker opens a PR;
 * the merge closes the issue). Any edge not listed here is rejected — that is
 * what fixes the label-typo class of bug.
 */
export const STAGE_GRAPH = {
  intake: ['design', 'queued'],
  design: ['queued', 'intake'],
  queued: ['build'],
  build: ['verify', 'queued', 'design', 'intake'],
  verify: ['audit', 'build'],
  audit: ['ship', 'build'],
  ship: [],
};

/** A user-facing error whose message is printed without a stack trace. */
export class SdlcError extends Error {}

export function isValidStage(stage) {
  return Object.prototype.hasOwnProperty.call(STAGE_GRAPH, stage);
}

export function isValidTransition(from, to) {
  return isValidStage(from) && (STAGE_GRAPH[from] ?? []).includes(to);
}

/**
 * Extract the single current stage from an issue's label names. Defensive:
 * throws on zero or multiple `stage:*` labels, or an unrecognized stage — all
 * of which are corrupt pipeline state a human should look at, not silently pick.
 */
export function currentStage(labelNames) {
  const stageLabels = (labelNames ?? []).filter((n) => n.startsWith('stage:'));
  if (stageLabels.length === 0) {
    throw new SdlcError('issue has no stage:* label — not in the pipeline');
  }
  if (stageLabels.length > 1) {
    throw new SdlcError(`issue has multiple stage labels: ${stageLabels.join(', ')}`);
  }
  const stage = stageLabels[0].slice('stage:'.length);
  if (!isValidStage(stage)) {
    throw new SdlcError(`unknown stage label "${stageLabels[0]}"`);
  }
  return stage;
}

/**
 * Compute the label edit for an advance/bounce. Returns the labels to remove
 * (current stage + sdlc:wip if present) and add (target stage), or throws an
 * SdlcError describing the illegal transition. Pure — no I/O.
 */
export function planAdvance(labelNames, toStage) {
  const from = currentStage(labelNames);
  if (!isValidStage(toStage)) {
    throw new SdlcError(`unknown target stage "${toStage}" (valid: ${STAGES.join(', ')})`);
  }
  if (from === toStage) {
    throw new SdlcError(`already at stage:${toStage} — nothing to do`);
  }
  if (!isValidTransition(from, toStage)) {
    const legal = (STAGE_GRAPH[from] ?? []).map((s) => `stage:${s}`).join(', ') || 'none';
    throw new SdlcError(
      `illegal transition stage:${from} → stage:${toStage} (legal from ${from}: ${legal})`,
    );
  }
  const removeLabels = [`stage:${from}`];
  if ((labelNames ?? []).includes(WIP_LABEL)) {
    removeLabels.push(WIP_LABEL);
  }
  return { from, to: toStage, removeLabels, addLabels: [`stage:${toStage}`] };
}

// --- I/O boundary: gh / git executors (injectable for tests) -------------------

const defaultGh = (args) => execFileSync('gh', args, { encoding: 'utf8' });
const defaultGit = (args) => execFileSync('git', args, { encoding: 'utf8' });

/** Fetch an issue's label names via gh. */
function fetchLabelNames(gh, issue) {
  const out = gh(['issue', 'view', String(issue), '--json', 'labels', '--jq', '.labels[].name']);
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function requireIssue(issue) {
  if (!issue || !/^#?\d+$/.test(String(issue))) {
    throw new SdlcError(`expected an issue number, got "${issue ?? ''}"`);
  }
  return String(issue).replace(/^#/, '');
}

// --- Commands ------------------------------------------------------------------

function cmdClaim(args, { gh, git, log }) {
  const issue = requireIssue(args[0]);
  gh(['issue', 'edit', issue, '--add-label', WIP_LABEL]);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const status = git(['status', '--short']).trimEnd();
  log(`claimed #${issue} (+${WIP_LABEL})`);
  log(`branch: ${branch}`);
  log(status ? `status:\n${status}` : 'status: clean');
}

function cmdAdvance(args, { gh, log }) {
  const issue = requireIssue(args[0]);
  const toStage = args[1];
  if (!toStage) {
    throw new SdlcError('advance requires a target stage: sdlc advance <issue> <to-stage>');
  }
  const labels = fetchLabelNames(gh, issue);
  const plan = planAdvance(labels, toStage);
  const editArgs = ['issue', 'edit', issue];
  for (const label of plan.removeLabels) {
    editArgs.push('--remove-label', label);
  }
  for (const label of plan.addLabels) {
    editArgs.push('--add-label', label);
  }
  gh(editArgs);
  log(`#${issue}: stage:${plan.from} → stage:${plan.to} (removed ${plan.removeLabels.join(', ')})`);
}

function cmdContext(args, { gh, git, log }) {
  const issue = requireIssue(args[0]);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const status = git(['status', '--short']).trimEnd();
  const view = JSON.parse(
    gh(['issue', 'view', issue, '--json', 'number,title,state,labels']),
  );
  const labels = (view.labels ?? []).map((l) => l.name);
  const prs = JSON.parse(gh(['pr', 'list', '--head', branch, '--json', 'number,title,state']));

  log(`#${view.number} [${view.state}] ${view.title}`);
  log(`stage: ${labels.find((n) => n.startsWith('stage:')) ?? '(none)'}`);
  const flags = labels.filter((n) => n.startsWith('sdlc:') || n.startsWith('priority:'));
  log(`labels: ${flags.length ? flags.join(', ') : '(none relevant)'}`);
  log(`branch: ${branch}`);
  log(status ? `status:\n${status}` : 'status: clean');
  if (prs.length) {
    log(`prs (head ${branch}): ${prs.map((p) => `#${p.number} [${p.state}]`).join(', ')}`);
  } else {
    log(`prs (head ${branch}): none`);
  }
}

function cmdWorktree(args, { git, log }, root) {
  const issue = requireIssue(args[0]);
  const branch = args[1] ?? `feat/${issue}`;
  const repoName = path.basename(root);
  const target = path.resolve(root, '..', `${repoName}-wt-${issue}`);
  git(['fetch', 'origin']);
  // Reuse an existing branch if present; otherwise create it off origin/dev.
  const existing = git(['branch', '--list', branch]).trim();
  if (existing) {
    git(['worktree', 'add', target, branch]);
  } else {
    git(['worktree', 'add', '-b', branch, target, 'origin/dev']);
  }
  log(`worktree: ${target} (branch ${branch})`);
}

function cmdComment(args, { gh, log }) {
  const issue = requireIssue(args[0]);
  const file = args[1];
  if (!file) {
    throw new SdlcError('comment requires a body file: sdlc comment <issue> <file>');
  }
  gh(['issue', 'comment', issue, '--body-file', file]);
  log(`#${issue}: comment posted from ${file}`);
}

const USAGE = `sdlc — deterministic SDLC pipeline one-shots

  sdlc claim   <issue>              add ${WIP_LABEL}, print branch + status
  sdlc advance <issue> <to-stage>   validate + swap stage label, drop ${WIP_LABEL}
  sdlc context <issue>              branch + status + issue labels/state + PRs
  sdlc worktree <issue> [<branch>]  add a sibling git worktree for the branch
  sdlc comment <issue> <file>       post a body-file comment (plumbing)

Stages: ${STAGES.join(' → ')}`;

const COMMANDS = {
  claim: cmdClaim,
  advance: cmdAdvance,
  context: cmdContext,
  worktree: cmdWorktree,
  comment: cmdComment,
};

/**
 * Run one sdlc command. `deps` is injectable so tests can supply fake gh/git
 * executors and capture the exact CLI invocations. Returns nothing; throws
 * SdlcError on user error.
 */
export function runSdlc(argv, deps = {}) {
  const {
    gh = defaultGh,
    git = defaultGit,
    log = (msg) => console.log(msg),
    root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  } = deps;
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    log(USAGE);
    return;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    throw new SdlcError(`unknown command "${command}"\n\n${USAGE}`);
  }
  handler(rest, { gh, git, log }, root);
}

// Only run when invoked directly, so tests can import the pure helpers.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runSdlc(process.argv.slice(2));
  } catch (err) {
    if (err instanceof SdlcError) {
      console.error(`sdlc: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
