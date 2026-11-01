import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
import { claimAction } from "./community-commands.mjs";
const event = JSON.parse(
    await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  ),
  client = github();
const number = event.issue?.number;
if (!Number.isSafeInteger(number) || number < 1) throw Error("Invalid issue");
const issue = await client.api(`/issues/${number}`),
  plan = claimAction(event, issue);
if (!plan) {
  await summary(
    "No eligible claim. Only open help-wanted Issues can be self-assigned.",
  );
  process.exit(0);
}
await client.api(
  `/issues/${number}/assignees`,
  plan.action === "claim" ? "POST" : "DELETE",
  { assignees: [plan.login] },
);
const current = await client.api(`/issues/${number}`);
if (
  current.assignees.some((a) => a.login === plan.login) !==
  (plan.action === "claim")
)
  throw Error("Assignment was not applied; check GitHub assignability");
await summary(
  `Issue #${number}: ${plan.action}. Only the comment author was affected.`,
);
