import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseAutomaticIssue,
  eligibleAutomaticIssue,
  automaticMode,
} from "../scripts/auto-draft.mjs";
const issue = {
  number: 42,
  state: "open",
  user: { login: "github-actions[bot]" },
  labels: [{ name: "atlas:received" }],
  body: `<!-- safety-atlas:cloud 12345678-1234-4234-8234-123456789abc -->\n\n<!-- safety-atlas:public-record ${"a".repeat(64)} -->`,
};
test("automatic drafts only select authenticated public bridge issues and stop after one attempt", () => {
  assert.equal(eligibleAutomaticIssue(issue), true);
  for (const value of [
    { ...issue, user: { login: "visitor" } },
    { ...issue, pull_request: {} },
    { ...issue, state: "closed" },
    { ...issue, body: "forged proposal" },
    ...[
      "atlas:auto-attempted",
      "atlas:hold",
      "atlas:declined",
      "atlas:needs-info",
    ].map((name) => ({ ...issue, labels: [...issue.labels, { name }] })),
  ])
    assert.equal(eligibleAutomaticIssue(value), false);
  assert.equal(chooseAutomaticIssue([issue], []).number, 42);
  assert.equal(
    chooseAutomaticIssue(
      [issue],
      [{ user: { login: "visitor" }, body: "Source submission: #42\n" }],
    ).number,
    42,
  );
  assert.equal(
    chooseAutomaticIssue(
      [issue],
      [
        {
          user: { login: "github-actions[bot]" },
          body: "Source submission: #42\n",
        },
      ],
    ),
    null,
  );
  assert.equal(
    chooseAutomaticIssue(
      [issue],
      Array.from({ length: 10 }, () => ({
        user: { login: "github-actions[bot]" },
      })),
    ),
    null,
  );
});
test("automatic privilege path cannot be enabled by a PR, comment event, branch or another workflow", () => {
  const env = {
    ATLAS_AUTOMATIC_PROPOSAL: "true",
    GITHUB_EVENT_NAME: "schedule",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_WORKFLOW_REF:
      "owner/repo/.github/workflows/community-drafts.yml@refs/heads/main",
  };
  assert.equal(automaticMode(env), true);
  for (const update of [
    { GITHUB_EVENT_NAME: "issue_comment" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_REF: "refs/heads/evil" },
    {
      GITHUB_WORKFLOW_REF:
        "owner/repo/.github/workflows/evil.yml@refs/heads/main",
    },
  ])
    assert.throws(() => automaticMode({ ...env, ...update }), /trusted main/);
  assert.equal(
    automaticMode({ ...env, ATLAS_AUTOMATIC_PROPOSAL: "false" }),
    false,
  );
});
