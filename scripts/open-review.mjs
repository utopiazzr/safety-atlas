import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
import { revisionOf } from "./review.mjs";
const client = github(),
  context = JSON.parse(
    await fs.readFile("work/candidate/proposal-context.json", "utf8"),
  );
const current = await client.issueSnapshot(context.number);
if (revisionOf(current.issue, current.comments) !== context.revision)
  throw Error("Issue changed during review. Rerun with the latest evidence.");
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
      content: await fs.readFile("data/signals.json", "utf8"),
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
