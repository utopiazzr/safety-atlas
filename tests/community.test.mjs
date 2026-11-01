import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  prepareCommunity,
  recordReference,
  canCurate,
} from "../scripts/community.mjs";
import { intakeMetadata } from "../src/intake.mjs";
const record = {
  title: "Example research",
  summary: "Attributed claim with limits",
  sources: ["https://example.org/research"],
  evidenceType: "research-poc",
  kind: "attack",
  intent: "new",
  relatedId: "",
  provenance: "research",
  context: "Model v1",
  limitations: "Not independently reproduced",
  disclosure: "community",
  verification: "unverified",
};
function issue(value = record) {
  return {
    number: 12,
    title: value.title,
    user: { login: "github-actions[bot]" },
    html_url: "https://github.com/owner/repo/issues/12",
    body: `<!-- safety-atlas:cloud 12345678-1234-4234-8234-123456789abc -->\n\n<!-- safety-atlas:public-record ${createHash("sha256").update(JSON.stringify(value)).digest("hex")} -->\n\n<!-- safety-atlas:intake ${JSON.stringify(intakeMetadata(`<!-- safety-atlas:intake ${JSON.stringify(value)} -->`))} -->\n\n${value.summary}\n${value.sources.join("\n")}`,
  };
}
test("community curation is limited to repository collaborators and authenticated bridge records", () => {
  assert.equal(canCurate({ permission: "read", role_name: "read" }), false);
  assert.equal(canCurate({ permission: "read", role_name: "triage" }), true);
  assert.equal(canCurate({ permission: "write" }), true);
  assert.throws(
    () => recordReference({ ...issue(), user: { login: "visitor" } }),
    /bridge/,
  );
  assert.throws(
    () => prepareCommunity(issue(), [], { ...record, summary: "changed" }, []),
    /changed/,
  );
});
test("public proposal fields map to a PR without retyping and supplements preserve the original summary", () => {
  const p = prepareCommunity(issue(), [], record, []);
  assert.equal(p.input.title, record.title);
  assert.equal(p.input.context, record.context);
  assert.equal(p.input.decision, "draft-new");
  assert.equal(p.candidate.kind, "attack");
  const supplement = { ...record, intent: "evidence", relatedId: "existing" };
  const existing = { id: "existing", title: "Old", sources: [], resources: [] };
  const e = prepareCommunity(issue(supplement), [], supplement, [existing]);
  assert.equal(e.input.decision, "draft-update");
  assert.equal(e.input.summary, "");
  assert.equal(e.input.target_id, "existing");
});
test("matching sources stop automatic duplicate entry creation", () => {
  assert.throws(
    () =>
      prepareCommunity(issue(), [], record, [
        {
          id: "existing",
          title: "Old",
          sources: [{ url: record.sources[0] }],
          resources: [],
        },
      ]),
    /Possible existing/,
  );
});
