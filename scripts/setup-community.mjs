import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
const client = github(),
  labels = JSON.parse(await fs.readFile(".github/labels.json", "utf8"));
let created = 0;
for (const label of labels) {
  if (
    !/^[\w :\-]{1,50}$/.test(label.name) ||
    !/^[a-f0-9]{6}$/.test(label.color)
  )
    throw Error("Invalid label definition");
  try {
    await client.api("/labels", "POST", label);
    created++;
  } catch (e) {
    if (e.status !== 422) throw e;
  }
}
await summary(
  `Created ${created} missing labels. Existing labels, Issues and discussions were preserved.`,
);
