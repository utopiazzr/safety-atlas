import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
import { revisionOf } from "./review.mjs";
import { boundedJson, validateProposalArtifact } from "./proposal-artifact.mjs";
import { automaticMode, eligibleAutomaticIssue } from "./auto-draft.mjs";
import { INTAKE, recordReference, prepareCommunity } from "./community.mjs";
const automatic = automaticMode();
const isolated = process.env.ATLAS_ISOLATED_REVIEW === "true";
if (process.env.GITHUB_ACTIONS === "true" && !isolated)
  throw Error("Publication requires an isolated job");
const client = github(),
  context = await boundedJson(
    isolated
      ? "work/review-artifact/proposal-context.json"
      : "work/candidate/proposal-context.json",
    16000,
  );
if (
  Boolean(context.automatic) !== automatic ||
  (automatic && context.number !== Number(process.env.ATLAS_ISSUE_NUMBER))
)
  throw Error("Proposal context does not match the selected workflow");
let content = await fs.readFile("data/signals.json", "utf8");
if (isolated) {
  const proposed = await boundedJson(
    "work/review-artifact/catalogue.json",
    2 * 1024 * 1024,
  );
  validateProposalArtifact(JSON.parse(content), proposed, context, {
    actor: automatic ? "github-actions[bot]" : process.env.GITHUB_ACTOR,
    baseSha: process.env.GITHUB_SHA,
    repo: client.repo,
  });
  content = JSON.stringify(proposed, null, 2) + "\n";
}
const current = await client.issueSnapshot(context.number);
if (current.issue.state === "closed")
  throw Error("Issue is closed; do not prepare a new proposal");
if (revisionOf(current.issue, current.comments) !== context.revision)
  throw Error("Issue changed during review. Rerun with the latest evidence.");
if (automatic) {
  if (!eligibleAutomaticIssue(current.issue))
    throw Error("Public proposal is no longer eligible");
  const ref = recordReference(current.issue);
  const response = await fetch(`${INTAKE}/public/records/${ref.id}`, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("Public proposal unavailable or withdrawn");
  prepareCommunity(
    current.issue,
    current.comments,
    await response.json(),
    JSON.parse(await fs.readFile("data/signals.json", "utf8")),
  );
}
// Do not create a second draft for the same Issue snapshot on retries.
let openBotPRs = 0;
for (let page = 1; page <= 10; page++) {
  const batch = await client.api(`/pulls?state=open&per_page=100&page=${page}`);
  openBotPRs += batch.filter(
    (pr) => pr.user?.login === "github-actions[bot]",
  ).length;
  const previous = batch.find(
    (pr) =>
      pr.user?.login === "github-actions[bot]" &&
      pr.body?.includes(`Source submission: #${context.number}\n`),
  );
  if (previous) {
    await summary(
      `[Existing draft PR](${previous.html_url}); update or close it before preparing another.`,
    );
    process.exit(0);
  }
  if (batch.length < 100) break;
  if (page === 10)
    throw Error("Too many open PRs; inspect existing proposals manually");
}
if (automatic && openBotPRs >= 10)
  throw Error("Automatic draft capacity reached; review existing PRs first");
const repo = await client.api(""),
  base = repo.default_branch;
const head = await client.api(`/git/ref/heads/${encodeURIComponent(base)}`);
// Checkout SHA is the exact base used by the tested proposal; never overwrite concurrent catalogue edits.
if (head.object.sha !== process.env.GITHUB_SHA)
  throw Error("Default branch changed during review; rerun to incorporate it.");
const branch = `atlas/issue-${context.number}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
const baseCommit = await client.api(`/git/commits/${head.object.sha}`);
const tree = await client.api("/git/trees", "POST", {
  base_tree: baseCommit.tree.sha,
  tree: [
    {
      path: "data/signals.json",
      mode: "100644",
      type: "blob",
      content,
    },
  ],
});
const commit = await client.api("/git/commits", "POST", {
  message: `Curate ${context.entryId} from #${context.number}`,
  tree: tree.sha,
  parents: [head.object.sha],
});
await client.api("/git/refs", "POST", {
  ref: `refs/heads/${branch}`,
  sha: commit.sha,
});
await client.api(`/statuses/${commit.sha}`, "POST", {
  state: "success",
  context: "Atlas evidence snapshot",
  description: "Reviewed Issue revision matches the proposal",
});
const run = `https://github.com/${client.repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const compare = `https://github.com/${client.repo}/compare/${base}...${branch}?expand=1`;
let reviewUrl = compare;
try {
  const pr = await client.api("/pulls", "POST", {
    title: `Review ${context.entryId} · #${context.number}`,
    head: branch,
    base,
    draft: true,
    body: `## Proposed catalogue change\n\nSource submission: #${context.number}\n\n${context.rationale}\n\n- Evidence revision: \`${context.revision}\`\n- [Validation run](${run}): tests and build passed before this branch was created.\n- Source-linked means attributed, not independently reproduced.\n- Review the diff, sources, conditions, limitations and any invalidated animation before merging.\n- If the Issue changes, rerun curation. This PR does not auto-publish.\n\nGitHub may require a maintainer to approve workflow runs on this automation-created PR. Use Approve workflows to run in the PR. The creating run also supplies test/build validation; a manual Validate catalogue run can check the latest evidence but does not replace required PR checks.`,
  });
  reviewUrl = pr.html_url;
} catch (error) {
  if (![403, 422].includes(error.status)) throw error;
  await summary(
    `Draft PR creation was unavailable (${error.status}). The tested branch exists: [create a PR manually](${compare}). Repository Settings → Actions → General may restrict workflow-created PRs.`,
  );
}
await client.status(context.number, "in-review");
await client.comment(
  context.number,
  `**in-review** · 已整理为候选变更 / Proposed catalogue change\n\n[查看差异并审核 / Review changes](${reviewUrl})\n\n[Test and build](${run}) · 尚未发布，合并后才进入目录。 / Publication follows a reviewed merge.`,
  "<!-- safety-atlas:decision -->",
);
await summary(
  `[Review proposed entry](${reviewUrl}). No merge or publication was performed.`,
);
