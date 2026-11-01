import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeIssueUrl,
  makeMarkdown,
  validRepo,
  hasSignal,
  fenced,
} from "../src/submission.mjs";
const form = {
  title: "邮件 & 权限 #异常",
  kind: "suspicion",
  resourceType: "mixed",
  code: "",
  note: '引号 " 与换行\nhttps://example.org/?x=1&y=2',
};
test("prefill preserves user text and stays on GitHub", () => {
  const url = new URL(makeIssueUrl("owner/repo", form));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.searchParams.get("title"), "[怀疑线索] " + form.title);
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
    makeIssueUrl("owner/repo", { ...form, note: "长".repeat(2000) }),
    null,
  );
});
test("one link, code or attachment is sufficient without title or product", () => {
  const empty = { ...form, title: "", note: "", code: "" };
  assert.equal(hasSignal(empty), false);
  for (const draft of [
    { ...empty, note: "https://example.com" },
    { ...empty, code: "print(1)" },
  ])
    assert.equal(hasSignal(draft), true);
  assert.equal(hasSignal(empty, [{ name: "clip.webm" }]), true);
  assert.match(
    makeIssueUrl("owner/repo", empty, [{ name: "clip.webm", size: 50 }]),
    /clip.webm/,
  );
});
test("nested code fences survive and media are never described as uploaded", () => {
  const code = "```js\nalert(1)\n```";
  assert.ok(fenced(code).startsWith("````\n"));
  const body = makeMarkdown({ ...form, code }, [{ name: "x.mp4", size: 10 }]);
  assert.match(body, /尚未上传/);
  assert.ok(body.includes(code));
});
