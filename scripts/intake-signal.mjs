import fs from "node:fs/promises";
import { github, artifact, summary } from "./github.mjs";
import { normalizeIssue } from "./signals.mjs";
import { analyzeCandidate, revisionOf } from "./review.mjs";
const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const client = github(),
  { issue, comments } = await client.issueSnapshot(event.issue.number);
const candidate = normalizeIssue(issue, { comments });
const catalogue = JSON.parse(await fs.readFile("data/signals.json", "utf8"));
const analysis = analyzeCandidate(candidate, catalogue);
await artifact("signal.json", candidate);
await artifact("review.json", {
  revision: revisionOf(issue, comments),
  ...analysis,
});
const current = issue.labels
  ?.map((l) => l.name)
  .find((n) => n.startsWith("atlas:"));
if (!current || ["atlas:received", "atlas:needs-info"].includes(current))
  await client.status(issue.number, analysis.suggestedStatus);
const displayStatus =
  current && !["atlas:received", "atlas:needs-info"].includes(current)
    ? current
    : `atlas:${analysis.suggestedStatus}`;
const lines = [
  `已收到 / Received · **${displayStatus}**`,
  `这是一条公开投稿，尚不代表其主张已获核验。 / Receipt is not verification.`,
  analysis.prompt,
];
if (analysis.questions.length)
  lines.push(
    "可继续在正文或评论补充 / Helpful evidence:",
    ...analysis.questions.map((q) => `- ${q}`),
  );
if (analysis.matches.length)
  lines.push(
    "可能关联的已有档案（不会自动合并）/ Possible related entries:",
    ...analysis.matches.map(
      (m) =>
        `- [${m.id}](https://${client.repo.split("/")[0]}.github.io/${client.repo.split("/")[1]}/#entry=${m.id}) — ${m.reasons.join("；")}`,
    ),
  );
lines.push(
  `维护者会核对来源，随后补证、合并或建立审核 PR。 / Maintainers review sources before publication.\n[处理流程 / Workflow](https://github.com/${client.repo}/blob/main/docs/CONTRIBUTING.md)`,
);
await client.comment(issue.number, lines.join("\n\n"));
// If evidence changes while an editorial PR is open, invalidate its previous snapshot check.
const pulls = await client.api("/pulls?state=open&per_page=100");
for (const pr of pulls.filter(
  (p) =>
    p.head.repo?.full_name === client.repo &&
    p.head.ref.startsWith(`atlas/issue-${issue.number}-`),
)) {
  const file = await client.api(
    `/contents/data/signals.json?ref=${pr.head.sha}`,
  );
  const entries = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8"),
  );
  const proposal = entries.find(
    (e) => e.submission?.issueNumber === issue.number,
  );
  if (proposal?.submission.revision !== revisionOf(issue, comments))
    await client.api(`/statuses/${pr.head.sha}`, "POST", {
      state: "failure",
      context: "Atlas evidence snapshot",
      description: "Evidence changed; rerun Review community signal",
    });
}
await summary(
  `Issue #${issue.number}: ${displayStatus}. Candidate and review checklist are available as artifacts.`,
);
