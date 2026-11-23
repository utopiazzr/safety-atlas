import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cases } from "./cases.mjs";

const checkout = fileURLToPath(new URL("../../", import.meta.url));
const installed = await mkdtemp(join(tmpdir(), "desktop-import-release-"));
after(() => rm(installed, { recursive: true, force: true }));
async function copy(source, target = source) {
  const to = join(installed, target);
  await mkdir(dirname(to), { recursive: true });
  await cp(join(checkout, source), to, { recursive: true });
}
await Promise.all([
  copy("apps/desktop-import"),
  copy("apps/release-import"),
  copy("packages/format-import", "packages/format-import"),
  copy("integration-fixtures/f03-import/project", "project"),
]);
await copy("node_modules/prettier", "packages/format-import/node_modules/prettier");

const samples = cases(installed);
const load = (file) => import(pathToFileURL(join(installed, file)).href);
const { renderReleaseFile } = await load("apps/release-import/publish.mjs");

for (const { label, job, expected } of samples) {
  test(`desktop installed / ${label}`, async () => {
    const { previewCell } = await load("apps/desktop-import/preview.mjs");
    assert.equal(await previewCell(job), expected);
  });
}
test("desktop installed / background uses the same results for all supported cells", async () => {
  const { convertBatch } = await load("apps/desktop-import/batch.mjs");
  assert.deepEqual(await convertBatch(samples.map(({ job }) => job)), samples.map(({ expected }) => expected));
});
for (const [label, sample] of [
  ["markdown preserves an imported JavaScript example as literal prose", samples[0]],
  ["markdown preserves an imported TypeScript example as literal prose", samples[1]],
]) {
  test(`publisher installed / ${label}`, async () => {
    assert.equal(await renderReleaseFile(sample.job), sample.job.text + "\n");
  });
}
