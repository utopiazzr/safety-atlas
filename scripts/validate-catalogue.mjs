import fs from "node:fs/promises";
import { validateCatalogue, revisionOf } from "./review.mjs";
import { github } from "./github.mjs";
const entries = validateCatalogue(
  JSON.parse(await fs.readFile("data/signals.json", "utf8")),
);
// On PRs, check only new/changed proposals against the evidence snapshot. Historical records retain their historical revision.
if (process.env.ATLAS_CHECK_SNAPSHOTS === "true") {
  const client = github();
  const repo = await client.api("");
  const original = await client.api(
    `/contents/data/signals.json?ref=${encodeURIComponent(repo.default_branch)}`,
  );
  const baseline = JSON.parse(
    Buffer.from(original.content, "base64").toString("utf8"),
  );
  for (const entry of entries.filter((e) => e.submission)) {
    const old = baseline.find((e) => e.id === entry.id);
    if (JSON.stringify(old?.submission) === JSON.stringify(entry.submission))
      continue;
    const s = entry.submission;
    if (
      s.issueUrl !== `https://github.com/${client.repo}/issues/${s.issueNumber}`
    )
      throw Error("Unexpected submission repository");
    const snapshot = await client.issueSnapshot(s.issueNumber);
    if (revisionOf(snapshot.issue, snapshot.comments) !== s.revision)
      throw Error(
        `Evidence changed for ${entry.id}. Curate again before publishing.`,
      );
  }
}
console.log(`Validated ${entries.length} catalogue entries.`);
