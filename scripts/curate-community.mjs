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
const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const client = github(),
  actor = process.env.GITHUB_ACTOR;
if (!/^[\w-]+$/.test(actor || "")) throw Error("Invalid actor");
const permission = await client.api(`/collaborators/${actor}/permission`);
if (!canCurate(permission))
  throw Error("Repository triage or write permission required");
const number = Number(event.inputs?.issue_number || event.issue?.number);
const { issue, comments } = await client.issueSnapshot(number);
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
await artifact("review.json", prepared.analysis);
const proposal = createProposal(prepared.candidate, catalogue, prepared.input, {
  actor,
  revision,
});
for (const url of prepared.sources)
  if (
    !proposal.entry.sources.some(
      (s) => canonicalUrl(s.url) === canonicalUrl(url),
    )
  )
    proposal.entry.sources.push({ url, label: "社区提供的来源" });
validateCatalogue(proposal.catalogue);
await fs.writeFile(
  "data/signals.json",
  JSON.stringify(proposal.catalogue, null, 2) + "\n",
);
await artifact("proposal-context.json", {
  number,
  revision,
  entryId: proposal.entry.id,
  rationale: prepared.input.rationale,
});
await summary(
  "Prepared public fields without retyping. Tests and build run before a draft PR is created.",
);
