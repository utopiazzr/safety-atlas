import fs from "node:fs/promises";
import { validateCatalogue } from "./review.mjs";

export async function boundedJson(path, max) {
  const stat = await fs.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max)
    throw Error("Invalid or oversized proposal artifact");
  return JSON.parse(await fs.readFile(path, "utf8"));
}

export function validateProposalArtifact(
  baseline,
  proposed,
  context,
  { actor, baseSha, repo },
) {
  if (
    !context ||
    !Number.isSafeInteger(context.number) ||
    context.number < 1 ||
    !/^[a-z0-9-]{1,100}$/.test(context.entryId) ||
    !/^[a-f0-9]{64}$/.test(context.revision) ||
    context.baseSha !== baseSha ||
    typeof context.rationale !== "string" ||
    !context.rationale.trim() ||
    context.rationale.length > 4000
  )
    throw Error("Invalid proposal context");
  validateCatalogue(proposed);
  const old = baseline.find((e) => e.id === context.entryId),
    entry = proposed.find((e) => e.id === context.entryId);
  if (!entry || proposed.length !== baseline.length + (old ? 0 : 1))
    throw Error("Only one entry may change");
  if (!old && entry.id !== `issue-${context.number}`)
    throw Error("New entry must match the originating Issue");
  for (const existing of baseline)
    if (
      existing.id !== context.entryId &&
      JSON.stringify(existing) !==
        JSON.stringify(proposed.find((e) => e.id === existing.id))
    )
      throw Error("Unrelated catalogue changes are forbidden");
  const submission = entry.submission;
  if (
    !submission ||
    submission.issueNumber !== context.number ||
    submission.issueUrl !==
      `https://github.com/${repo}/issues/${context.number}` ||
    submission.revision !== context.revision ||
    submission.reviewedBy !== actor ||
    submission.rationale !== context.rationale ||
    entry.verification === "verified"
  )
    throw Error("Proposal provenance does not match the authorized workflow");
  return proposed;
}
