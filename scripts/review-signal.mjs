import fs from "node:fs/promises";
import { github, artifact, summary } from "./github.mjs";
import { normalizeIssue } from "./signals.mjs";
import {
  analyzeCandidate,
  createProposal,
  revisionOf,
  validateCatalogue,
} from "./review.mjs";
const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const input = event.inputs,
  client = github(),
  number = Number(input.issue_number);
const { issue, comments } = await client.issueSnapshot(number);
const candidate = normalizeIssue(issue, { comments });
const catalogue = JSON.parse(await fs.readFile("data/signals.json", "utf8"));
const revision = revisionOf(issue, comments);
await artifact("signal.json", candidate);
await artifact("review.json", {
  revision,
  ...analyzeCandidate(candidate, catalogue),
});
if (!String(input.rationale || "").trim())
  throw Error("A review rationale is required");
if (["request-info", "duplicate", "decline"].includes(input.decision)) {
  if (
    input.decision === "duplicate" &&
    !catalogue.some((e) => e.id === input.target_id)
  )
    throw Error(
      "Duplicate requires an existing target_id; new evidence should use draft-update",
    );
  const state = {
    "request-info": "needs-info",
    duplicate: "duplicate",
    decline: "declined",
  }[input.decision];
  await client.status(number, state);
  await client.comment(
    number,
    `**${state}** · @${process.env.GITHUB_ACTOR}\n\n${input.rationale}${input.target_id ? `\n\n关联档案 / Related entry: ${input.target_id}` : ""}\n\n可以在本 Issue 继续补充或请求重新审核。 / Further evidence and appeals are welcome.`,
    "<!-- safety-atlas:decision -->",
  );
  await summary(`Issue #${number}: ${state}. No catalogue change.`);
} else {
  const proposal = createProposal(candidate, catalogue, input, {
    actor: process.env.GITHUB_ACTOR,
    revision,
  });
  validateCatalogue(proposal.catalogue);
  await artifact("proposal.json", proposal.entry);
  await fs.writeFile(
    "data/signals.json",
    JSON.stringify(proposal.catalogue, null, 2) + "\n",
  );
  await artifact("proposal-context.json", {
    number,
    revision,
    entryId: proposal.entry.id,
    rationale: input.rationale,
  });
  await summary(
    `Prepared a proposed change for Issue #${number}. Tests and build must pass before creating the review branch.`,
  );
}
