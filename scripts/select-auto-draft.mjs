import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
import { automaticMode, chooseAutomaticIssue } from "./auto-draft.mjs";
if (!automaticMode()) throw Error("Automatic mode required");
const client = github();
async function list(route) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await client.api(`${route}&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  throw Error("Queue exceeds safe scan limit; inspect manually");
}
const pulls = await list("/pulls?state=open"),
  issues = await list(
    "/issues?state=open&labels=atlas%3Areceived&sort=created&direction=asc",
  );
const issue = chooseAutomaticIssue(issues, pulls);
if (issue)
  await fs.appendFile(process.env.GITHUB_OUTPUT, `issue=${issue.number}\n`);
await summary(
  issue
    ? `Selected public proposal #${issue.number}; at most one per run. No publication or approval.`
    : "No eligible public proposals, or the 10-PR capacity limit is reached.",
);
