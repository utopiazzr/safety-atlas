import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { previewCell } from "../../apps/desktop-import/preview.mjs";
import { cases } from "./cases.mjs";

const [sample] = cases(fileURLToPath(new URL(".", import.meta.url)));
test(sample.label, async () => {
  assert.equal(await previewCell(sample.job), sample.expected);
});
