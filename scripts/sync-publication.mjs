import fs from "node:fs/promises";
import { github } from "./github.mjs";
import { validateCatalogue } from "./review.mjs";
const client = github();
const entries = validateCatalogue(
  JSON.parse(await fs.readFile("data/signals.json", "utf8")),
);
for (const entry of entries.filter((e) => e.submission)) {
  const s = entry.submission;
  if (
    s.issueUrl !== `https://github.com/${client.repo}/issues/${s.issueNumber}`
  )
    throw Error("Publication points outside the repository");
  const marker = `<!-- safety-atlas:publication:${entry.id} -->`;
  const receipt = await client.findComment(s.issueNumber, marker);
  if (receipt?.body.includes(`evidence-revision: ${s.revision}`)) continue;
  await client.status(s.issueNumber, "published");
  await client.comment(
    s.issueNumber,
    `<!-- evidence-revision: ${s.revision} -->\n**published** · 已合并进目录 / Merged into the catalogue\n\n[${entry.id}](https://${client.repo.split("/")[0]}.github.io/${client.repo.split("/")[1]}/#entry=${entry.id})\n\nPages deployment follows separately. Source-linked does not mean independently reproduced.\n\n后续补证与更正仍可继续提交。 / Further evidence and corrections remain welcome.`,
    marker,
  );
}
