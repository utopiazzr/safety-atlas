import fs from "node:fs/promises";
import { github, artifact, summary } from "./github.mjs";
import {
  INTAKE,
  recordReference,
  prepareCommunity,
  canCurate,
} from "./community.mjs";
import { createProposal, revisionOf, validateCatalogue } from "./review.mjs";
import { canonicalUrl } from "../src/intake.mjs";
import { automaticMode, eligibleAutomaticIssue } from "./auto-draft.mjs";
const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const client = github(),
  automatic = automaticMode(),
  actor = automatic ? "github-actions[bot]" : process.env.GITHUB_ACTOR;
if (!automatic) {
  if (!/^[\w-]+$/.test(actor || "")) throw Error("Invalid actor");
  const permission = await client.api(`/collaborators/${actor}/permission`);
  if (!canCurate(permission))
    throw Error("Repository triage or write permission required");
}
const number = Number(
  automatic
    ? process.env.ATLAS_ISSUE_NUMBER
    : event.inputs?.issue_number || event.issue?.number,
);
const { issue, comments } = await client.issueSnapshot(number);
if (automatic && !eligibleAutomaticIssue(issue))
  throw Error("Public proposal is not eligible for automatic preparation");
const ref = recordReference(issue);
const response = await fetch(`${INTAKE}/public/records/${ref.id}`, {
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw Error("Public proposal unavailable or withdrawn");
const record = await response.json(),
  catalogue = JSON.parse(await fs.readFile("data/signals.json", "utf8"));
const prepared = prepareCommunity(issue, comments, record, catalogue),
  revision = revisionOf(issue, comments);
if (automatic)
  prepared.input.rationale =
    "Automatically prepared from an opt-in public snapshot. No human source review or independent reproduction has occurred; review evidence before merging.";
await artifact("review.json", prepared.analysis);
const proposal = createProposal(prepared.candidate, catalogue, prepared.input, {
  actor,
  revision,
  automatic,
});
for (const url of prepared.sources)
  if (
    !proposal.entry.sources.some(
      (s) => canonicalUrl(s.url) === canonicalUrl(url),
    )
  )
    proposal.entry.sources.push({ url, label: "社区提供的来源" });
validateCatalogue(proposal.catalogue);
await artifact("catalogue.json", proposal.catalogue);
await fs.writeFile(
  "data/signals.json",
  JSON.stringify(proposal.catalogue, null, 2) + "\n",
);
await artifact("proposal-context.json", {
  baseSha: process.env.GITHUB_SHA,
  automatic,
  number,
  revision,
  entryId: proposal.entry.id,
  rationale: prepared.input.rationale,
});
await summary(
  "Prepared public fields without retyping. Tests and build run before a draft PR is created.",
);
