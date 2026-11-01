import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeIssue } from "../scripts/signals.mjs";
import {
  readIntake,
  resourceType,
  extractLinks,
  canonicalUrl,
} from "../src/intake.mjs";
import { makeMarkdown, handoffUrl } from "../src/submission.mjs";
import {
  analyzeCandidate,
  createProposal,
  validateCatalogue,
  revisionOf,
} from "../scripts/review.mjs";
import { github } from "../scripts/github.mjs";
const catalogue = JSON.parse(
  fs
    .readFileSync(new URL("../data/signals.json", import.meta.url), "utf8")
    .replace(/^\uFEFF/, ""),
);
const source =
  "https://embracethered.com/blog/posts/2024/chatgpt-macos-app-persistent-data-exfiltration/";
const issue = {
  number: 42,
  title: "[外部报道] SpAIware report",
  body: `${source}\nA historical researcher demonstration, not a claim that all current versions are affected.`,
  html_url: "https://github.com/utopiazzr/safety-atlas/issues/42",
  user: { login: "contributor" },
  updated_at: "2026-11-01T00:00:00Z",
};
const form = {
  kind: "report",
  intent: "new",
  provenance: "reported",
  relatedId: "",
  title: "Source",
  note: source,
  code: "",
  context: "macOS app; historical version",
};
const input = {
  decision: "draft-new",
  title: "Historical SpAIware demonstration",
  summary:
    "The researcher described memory-mediated exfiltration in a historical app version.",
  evidence_type: "research-poc",
  source_url: source,
  context: "Historical macOS app",
  limitations: "Not independently reproduced here.",
  rationale: "Checked the original disclosure and its stated remediation.",
};
const audit = {
  actor: "maintainer",
  revision: revisionOf(issue),
  now: "2026-11-01T01:00:00Z",
};
test("website handoff round trips intent, provenance and related entry without approval authority", () => {
  const body = makeMarkdown({
    ...form,
    intent: "correction",
    relatedId: "spaiware",
  });
  const parsed = readIntake(body);
  assert.deepEqual(parsed, {
    kind: "report",
    intent: "correction",
    provenance: "reported",
    relatedId: "spaiware",
  });
  const candidate = normalizeIssue({
    ...issue,
    body: body.replace(
      '"version":1',
      '"version":1,"review":"approved","verification":"verified"',
    ),
  });
  assert.equal(candidate.review, "pending");
  assert.equal(candidate.verification, "unverified");
  assert.ok(
    handoffUrl("owner/repo", { ...form, note: "a".repeat(30000) }).includes(
      "template=web-signal.md",
    ),
  );
});
test("direct GitHub form preserves suspicion, corrections and first-hand provenance", () => {
  const body =
    "### 信号类型 / Signal type\n\n怀疑线索 / Suspicion\n\n### 投稿目的 / Purpose\n\n更正信息 / Correction\n\n### 关联档案 ID（可选）/ Related entry\n\nspaiware\n\n### 你如何得知 / How you know\n\n亲身观察 / Firsthand";
  assert.deepEqual(readIntake(body), {
    kind: "suspicion",
    intent: "correction",
    relatedId: "spaiware",
    provenance: "observed",
  });
});
test("mixed PAIR-style paper, repository, model and video links retain individual resource types", () => {
  const urls = [
    "https://arxiv.org/abs/2310.08419",
    "https://github.com/patrickrchao/JailbreakingLLMs",
    "https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M",
    "https://example.org/proof.mp4",
  ];
  const candidate = normalizeIssue({
    ...issue,
    body:
      urls.join("\n") + '\n```python\nurl="https://payload.example/exfil"\n```',
  });
  assert.deepEqual(
    candidate.resources.filter((r) => r.url).map((r) => r.type),
    ["link", "repository", "model", "video"],
  );
  assert.ok(!candidate.sources.some((s) => s.url.includes("payload.example")));
  assert.equal(
    resourceType("https://github.com.evil.example/owner/repo"),
    "link",
  );
  assert.deepEqual(
    extractLinks(
      "[paper](https://example.org/a_(b))\nhttps://example.org/page?x=1&y=2。",
    ),
    ["https://example.org/a_(b)", "https://example.org/page?x=1&y=2"],
  );
});
test("same primary source suggests an existing entry; it never merges automatically", () => {
  const candidate = normalizeIssue(issue),
    analysis = analyzeCandidate(candidate, catalogue);
  assert.ok(analysis.matches.some((m) => m.id === "spaiware"));
  assert.equal(candidate.review, "pending");
  assert.equal(
    canonicalUrl(source + "?utm_source=community#part"),
    canonicalUrl(source),
  );
  assert.notEqual(
    canonicalUrl("https://example.org/?version=1"),
    canonicalUrl("https://example.org/?version=2"),
  );
});
test("media placeholders and incorrect supplement targets block publication, not intake", () => {
  const candidate = normalizeIssue({
    ...issue,
    body: makeMarkdown(form, [{ name: "proof.mp4", size: 500 }]),
  });
  assert.ok(analyzeCandidate(candidate, catalogue).questions.length);
  assert.throws(
    () => createProposal(candidate, catalogue, input, audit),
    /pending attachment/,
  );
  const correction = normalizeIssue({
    ...issue,
    body: makeMarkdown({ ...form, intent: "correction", relatedId: "unknown" }),
  });
  assert.throws(
    () =>
      createProposal(
        correction,
        catalogue,
        { ...input, decision: "draft-update", target_id: "unknown" },
        audit,
      ),
    /existing target/,
  );
  assert.throws(
    () => createProposal(correction, catalogue, input, audit),
    /must use draft-update/,
  );
});
test("maintainer curation keeps source attribution separate from verified reproduction", () => {
  const proposal = createProposal(
    normalizeIssue(issue),
    catalogue,
    input,
    audit,
  );
  assert.equal(proposal.entry.verification, "source-linked");
  assert.equal(proposal.entry.storyboard, null);
  assert.equal(proposal.entry.submission.revision, audit.revision);
  validateCatalogue(proposal.catalogue);
  proposal.entry.verification = "verified";
  assert.throws(
    () => validateCatalogue(proposal.catalogue),
    /independent reproduction/,
  );
});
test("corrections preserve identity, add evidence and invalidate outdated animation", () => {
  const candidate = normalizeIssue({
    ...issue,
    body: makeMarkdown({
      ...form,
      intent: "correction",
      relatedId: "spaiware",
      code: 'redacted_log = "new evidence"',
    }),
  });
  const proposal = createProposal(
    candidate,
    catalogue,
    { ...input, decision: "draft-update", target_id: "spaiware" },
    audit,
  );
  assert.equal(proposal.catalogue.length, catalogue.length);
  assert.equal(proposal.entry.id, "spaiware");
  assert.equal(proposal.entry.visualizationStatus, "needs-review");
  assert.ok(proposal.entry.resources.some((r) => r.type === "code"));
  assert.equal(proposal.entry.storyboard, null);
});
test("human evidence edits invalidate a revision; bot status and label changes do not", () => {
  assert.notEqual(
    revisionOf(issue),
    revisionOf({ ...issue, body: "changed evidence" }),
  );
  assert.equal(
    revisionOf(issue),
    revisionOf({ ...issue, updated_at: "later", labels: ["received"] }, [
      { user: { type: "Bot" }, body: "receipt" },
    ]),
  );
  assert.notEqual(
    revisionOf(issue),
    revisionOf(issue, [
      { id: 1, user: { type: "User" }, body: "new observation" },
    ]),
  );
});
test("partial material extraction blocks automatic proposals and preserves comment code", () => {
  const candidate = normalizeIssue({
    ...issue,
    body: Array.from({ length: 25 }, (_, i) => `https://example.org/${i}`).join(
      "\n",
    ),
  });
  assert.equal(candidate.intake.materialsPartial, true);
  assert.throws(
    () => createProposal(candidate, catalogue, input, audit),
    /partial evidence/,
  );
  const withCode = normalizeIssue(issue, {
    comments: [
      { body: "```python\nredacted = True\n```", user: { login: "witness" } },
    ],
  });
  assert.ok(
    withCode.resources.some(
      (r) => r.type === "code" && r.content.includes("redacted"),
    ),
  );
  assert.equal(
    resourceType("https://github.com/user-attachments/assets/abc"),
    "link",
  );
});
test("GitHub API client paginates discussion and never fetches submitted URLs or redirects", async () => {
  const calls = [];
  const client = github({
    repo: "owner/repo",
    token: "test",
    request: async (url, options) => {
      calls.push(url);
      assert.equal(new URL(url).origin, "https://api.github.com");
      assert.equal(options.redirect, "error");
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/comments")
            ? url.includes("page=2")
              ? [{ id: 101, user: { type: "User" }, body: "supplement" }]
              : Array.from({ length: 100 }, (_, i) => ({
                  id: i,
                  user: { type: "Bot" },
                }))
            : { ...issue, body: "https://untrusted.example/never-fetch" },
      };
    },
  });
  const snapshot = await client.issueSnapshot(42);
  assert.equal(snapshot.comments.length, 1);
  assert.equal(calls.length, 3);
  await assert.rejects(
    () => client.api("https://evil.example"),
    /Invalid API path/,
  );
});
