import { github, summary } from "./github.mjs";
import {
  automaticMode,
  eligibleAutomaticIssue,
  AUTO_ATTEMPTED,
} from "./auto-draft.mjs";
if (!automaticMode()) throw Error("Automatic mode required");
const number = Number(process.env.ATLAS_ISSUE_NUMBER),
  client = github();
if (!Number.isSafeInteger(number) || number < 1) throw Error("Invalid issue");
const issue = await client.api(`/issues/${number}`);
// Success changed the status to in-review; a failure may only touch the selected eligible issue.
if (
  process.env.ATLAS_PUBLISH_RESULT !== "success" &&
  !eligibleAutomaticIssue(issue)
)
  process.exit(0);
try {
  await client.api("/labels", "POST", {
    name: AUTO_ATTEMPTED,
    color: "716e66",
    description:
      "Automatic preparation attempted; fix and request manual curation before retrying",
  });
} catch (e) {
  if (e.status !== 422) throw e;
}
await client.api(`/issues/${number}/labels`, "POST", {
  labels: [AUTO_ATTEMPTED],
});
if (process.env.ATLAS_PUBLISH_RESULT !== "success") {
  await client.status(number, "needs-info");
  await client.comment(
    number,
    `自动拟稿暂停 / Automatic preparation paused.\n\n[检查记录 / Run details](https://github.com/${client.repo}/actions/runs/${process.env.GITHUB_RUN_ID})\n\n来源重复、材料不完整、证据变化或运行失败需要检查。补充材料后，协作者可用 atlas:propose 重新整理；机器人不会循环重试或自动收录。`,
    "<!-- safety-atlas:auto-draft -->",
  );
}
await summary(
  `Recorded one automatic attempt for #${number}. No automatic retry loop.`,
);
