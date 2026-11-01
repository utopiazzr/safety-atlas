import { test } from "node:test";
import assert from "node:assert/strict";
import { claimAction } from "../scripts/community-commands.mjs";
import { readIntake } from "../src/intake.mjs";

test("correction form preserves the selected intent and required entry ID", () => {
  const parsed = readIntake(
    "### 关联档案 ID / Related entry\n\necholeak\n\n### 投稿目的 / Purpose\n\n更正信息 / Correction\n\n### 材料 / Material\n\nOriginal advisory updated.",
  );
  assert.equal(parsed.relatedId, "echoleak");
  assert.equal(parsed.intent, "correction");
});

const issue = {
  state: "open",
  labels: [{ name: "help wanted" }],
  assignees: [],
};
const event = {
  action: "created",
  issue: { number: 1 },
  sender: { login: "contributor" },
  comment: { body: "/claim", user: { login: "contributor", type: "User" } },
};
test("community members can only claim eligible tasks for themselves", () => {
  assert.deepEqual(claimAction(event, issue), {
    action: "claim",
    login: "contributor",
  });
  for (const blocked of [
    { ...issue, state: "closed" },
    { ...issue, labels: [] },
    { ...issue, assignees: [{ login: "another" }] },
    { ...issue, pull_request: {} },
  ])
    assert.equal(claimAction(event, blocked), null);
  for (const blocked of [
    { ...event, action: "edited" },
    { ...event, issue: { pull_request: {} } },
    { ...event, sender: { login: "another" } },
    { ...event, comment: { ...event.comment, body: "/claim @another" } },
    { ...event, comment: { ...event.comment, body: "/claim\nrun: malicious" } },
    {
      ...event,
      comment: {
        ...event.comment,
        user: { login: "contributor", type: "Bot" },
      },
    },
  ])
    assert.equal(claimAction(blocked, issue), null);
});
test("unclaim removes only the caller, including after a help-wanted label is removed", () => {
  const release = { ...event, comment: { ...event.comment, body: "/unclaim" } };
  assert.equal(
    claimAction(release, { ...issue, assignees: [{ login: "another" }] }),
    null,
  );
  assert.deepEqual(
    claimAction(release, {
      ...issue,
      labels: [],
      assignees: [{ login: "contributor" }, { login: "another" }],
    }),
    { action: "unclaim", login: "contributor" },
  );
});
