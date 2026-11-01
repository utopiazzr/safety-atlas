import { test } from "node:test";
import assert from "node:assert/strict";
import { makeIssueUrl, makeMarkdown, validRepo } from "../src/submission.mjs";
const form = {
  title: "邮件 & 权限 #异常",
  product: "助手 v1",
  category: "提示注入",
  description: '引号 " 与换行\n都应保留',
  evidence: "https://example.org/?x=1&y=2",
};
test("prefill preserves user text and stays on GitHub", () => {
  const url = new URL(makeIssueUrl("owner/repo", form));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.searchParams.get("title"), "[Case] " + form.title);
  assert.equal(url.searchParams.get("body"), makeMarkdown(form));
});
test("rejects invalid or injected repository targets", () => {
  for (const repo of [
    "",
    "https://evil.test",
    "../repo",
    "owner/repo?x=1",
    "owner/repo/issues",
  ])
    assert.equal(validRepo(repo), false);
});
test("oversized reports require download instead of truncation", () => {
  assert.equal(
    makeIssueUrl("owner/repo", { ...form, description: "长".repeat(2000) }),
    null,
  );
});
