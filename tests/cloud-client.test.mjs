import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newReceipt,
  parseReceipt,
  inspectFiles,
  allowedProjectPath,
  uploadProject,
} from "../src/cloud-client.mjs";
test("receipt import rejects alternate hosts and path traversal", () => {
  const receipt = newReceipt();
  assert.deepEqual(parseReceipt(receipt), receipt);
  assert.throws(() =>
    parseReceipt({ ...receipt, api: "https://evil.example" }),
  );
  for (const path of [
    "../secret",
    "project/.env",
    "p/node_modules/a",
    "p/.git/config",
    "x.key",
    "run.exe",
  ])
    assert.equal(allowedProjectPath(path), false);
  const file = new File(["hello"], "guardrail.py");
  assert.equal(inspectFiles([file]).accepted.length, 1);
  assert.equal(inspectFiles([file, file]).rejected.length, 1);
});
test("resume checks existing bytes and uploads only missing chunks before completing", async () => {
  const original = globalThis.fetch,
    receipt = newReceipt(),
    file = new File(["hello"], "evidence.txt");
  const digest = Buffer.from(
    await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
  ).toString("hex");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    return new Response(
      JSON.stringify(
        url.endsWith("/complete")
          ? { status: "submitted" }
          : {
              status: "uploading",
              files: [{ id: 0, path: file.name, size: 5 }],
              parts: [{ file_id: 0, part_number: 0, digest }],
            },
      ),
      { status: 200 },
    );
  };
  try {
    assert.equal(
      (
        await uploadProject(
          receipt,
          [{ path: file.name, size: 5, file }],
          () => {},
        )
      ).status,
      "submitted",
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1].method, "POST");
    assert.equal(calls[0][1].headers.Authorization, `Bearer ${receipt.key}`);
    await assert.rejects(
      () =>
        uploadProject(
          receipt,
          [{ path: file.name, size: 5, file: new File(["other"], file.name) }],
          () => {},
        ),
      /File changed/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
