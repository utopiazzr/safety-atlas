import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeIssue,
  validateSignal,
  generateStoryboard,
} from "../scripts/signals.mjs";
const issue = {
  number: 12,
  title: "[攻击方法] A method",
  html_url: "https://github.com/owner/repo/issues/12",
  body: '## 攻击方法\n材料形式：model\nhttps://example.com/model\n\n```python\nprint("hello")\n```\nThis is source evidence for a draft that needs review.',
};
test("normalize public input preserves evidence, typed resources and pending state", () => {
  const s = normalizeIssue(issue);
  assert.equal(s.kind, "attack");
  assert.equal(s.review, "pending");
  assert.equal(s.verification, "unverified");
  assert.ok(s.resources.some((x) => x.type === "model"));
  assert.ok(s.resources.some((x) => x.type === "code"));
  assert.throws(() => validateSignal(s, { publish: true }), /approval/);
});
test("catalogue entries include valid sources and publication metadata", () => {
  const entries = JSON.parse(
    fs
      .readFileSync(new URL("../data/signals.json", import.meta.url), "utf8")
      .replace(/^\uFEFF/, ""),
  );
  assert.ok(entries.length >= 9);
  const ids = new Set();
  for (const s of entries) {
    validateSignal(s, { publish: true });
    assert.ok(!ids.has(s.id));
    ids.add(s.id);
  }
});
test("unsafe links and invented storyboard evidence are rejected", () => {
  const s = normalizeIssue(issue);
  s.resources.push({ type: "link", url: "javascript:alert(1)" });
  assert.throws(() => validateSignal(s), /URL/);
  s.resources.pop();
  s.storyboard = {
    disclaimer: "Illustration",
    steps: [0, 1].map(() => ({
      title: "step",
      body: "claim",
      sourceIndex: 0,
      evidence: "invented quote",
    })),
  };
  assert.throws(() => validateSignal(s), /Evidence/);
});
test("no model configuration means no paid request or fabricated storyboard", async () => {
  const s = await generateStoryboard(normalizeIssue(issue), {
    request: () => {
      throw Error("must not call");
    },
  });
  assert.equal(s.storyboard, null);
  assert.equal(s.storyboardStatus, "awaiting-model-configuration");
});
test("compatible endpoint accepts variable steps and always keeps model output pending", async () => {
  const s = normalizeIssue(issue);
  const request = async (url, options) => {
    assert.equal(url.href, "https://model.example/v1/chat/completions");
    assert.equal(options.redirect, "error");
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                steps: [0, 1, 2].map((_, i) => ({
                  title: "阶段" + i,
                  body: "依据来源的示意",
                  sourceIndex: 0,
                  evidence: "source evidence",
                  ...(i === 2 ? { loopTo: 0 } : {}),
                })),
              }),
            },
          },
        ],
      }),
    };
  };
  const out = await generateStoryboard(s, {
    baseUrl: "https://model.example/v1",
    model: "test",
    apiKey: "test-only",
    request,
  });
  assert.equal(out.storyboard.steps.length, 3);
  assert.equal(out.review, "pending");
  assert.equal(out.verification, "unverified");
});
