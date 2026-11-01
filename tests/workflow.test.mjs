import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { revisionOf } from "../scripts/review.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = {
  number: 42,
  title: "[外部报道] Historical research",
  body: "https://arxiv.org/abs/2310.08419",
  html_url: "https://github.com/owner/repo/issues/42",
  labels: [{ name: "human-label" }],
  user: { login: "contributor" },
};
const input = {
  issue_number: "42",
  decision: "draft-new",
  title: "Research with scoped claims",
  summary: "An attributed research method under specified conditions.",
  evidence_type: "paper",
  source_url: "https://arxiv.org/abs/2310.08419",
  rationale: "Checked original publication.",
  context: "Black-box target; query budget matters.",
  limitations: "Not independently reproduced.",
};
const mock = `import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('fixture.json','utf8'));
globalThis.fetch=async(url,options)=>{
 const u=new URL(url),route=u.pathname.replace('/repos/owner/repo','');
 const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
 fs.appendFileSync('calls.jsonl',JSON.stringify({route,method,body})+'\\n');
 let data={},status=200;
 if(route==='/issues/42'&&method==='GET') data=fixture;
 else if(route==='/issues/42/comments'&&method==='GET') data=[];
 else if(route===''&&method==='GET') data={default_branch:'main'};
 else if(route==='/git/ref/heads/main') data={object:{sha:process.env.MOVED==='1'?'new-head':'base-head'}};
 else if(route==='/git/commits/base-head') data={tree:{sha:'base-tree'}};
 else if(route==='/git/trees') data={sha:'new-tree'};
 else if(route==='/git/commits'&&method==='POST') data={sha:'new-commit'};
 else if(route==='/pulls'&&method==='GET') data=process.env.EXISTING_PR==='1'?[{user:{login:'github-actions[bot]'},body:'Source submission: #42\\n',html_url:'https://github.com/owner/repo/pull/100'}]:[];
 else if(route==='/pulls'&&method==='POST') {status=process.env.DENY_PR==='1'?403:201;data={html_url:'https://github.com/owner/repo/pull/100'};}
 else if(method==='GET') throw Error('Unexpected read: '+route);
 return {ok:status<400,status,json:async()=>data};
};`;
function setup() {
  const parent = path.join(root, "work");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "workflow-test-"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(
    path.join(root, "data/signals.json"),
    path.join(dir, "data/signals.json"),
  );
  fs.writeFileSync(
    path.join(dir, "event.json"),
    JSON.stringify({ inputs: input }),
  );
  fs.writeFileSync(path.join(dir, "fixture.json"), JSON.stringify(fixture));
  fs.writeFileSync(path.join(dir, "mock.mjs"), mock);
  const run = (script, extra = {}) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(path.join(dir, "mock.mjs")).href,
        path.join(root, "scripts", script),
      ],
      {
        cwd: dir,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_TOKEN: "fake-test-token",
          GITHUB_EVENT_PATH: path.join(dir, "event.json"),
          GITHUB_SHA: "base-head",
          GITHUB_ACTOR: "reviewer",
          GITHUB_RUN_ID: "99",
          GITHUB_RUN_ATTEMPT: "1",
          GITHUB_STEP_SUMMARY: path.join(dir, "summary.md"),
          ...extra,
        },
      },
    );
  const calls = () =>
    fs.existsSync(path.join(dir, "calls.jsonl"))
      ? fs
          .readFileSync(path.join(dir, "calls.jsonl"), "utf8")
          .trim()
          .split("\n")
          .map(JSON.parse)
      : [];
  const cleanup = () => {
    if (
      path.dirname(dir) !== parent ||
      !path.basename(dir).startsWith("workflow-test-")
    )
      throw Error("Unexpected test directory");
    fs.rmSync(dir, { recursive: true });
  };
  return { dir, run, calls, cleanup };
}
test("cloud review prepares a tested-data branch and draft PR without publishing main", () => {
  const t = setup();
  try {
    let result = t.run("review-signal.mjs");
    assert.equal(result.status, 0, result.stderr);
    const entries = JSON.parse(
      fs.readFileSync(path.join(t.dir, "data/signals.json"), "utf8"),
    );
    assert.equal(entries.at(-1).submission.revision, revisionOf(fixture));
    result = t.run("open-review.mjs");
    assert.equal(result.status, 0, result.stderr);
    const calls = t.calls();
    const pr = calls.find((x) => x.route === "/pulls" && x.method === "POST");
    assert.equal(pr.body.draft, true);
    assert.ok(
      calls.some(
        (x) =>
          x.route === "/git/refs" &&
          x.body.ref === "refs/heads/atlas/issue-42-99-1",
      ),
    );
    assert.ok(
      !calls.some(
        (x) => x.route.includes("/merge") || x.route === "/git/refs/heads/main",
      ),
    );
    assert.ok(
      !calls.some(
        (x) => x.method === "DELETE" && x.route.includes("human-label"),
      ),
    );
  } finally {
    t.cleanup();
  }
});
test("retry reuses an open proposal without writing a second branch", () => {
  const t = setup();
  try {
    assert.equal(t.run("review-signal.mjs").status, 0);
    const result = t.run("open-review.mjs", { EXISTING_PR: "1" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      t.calls().some((c) => c.route === "/git/refs"),
      false,
    );
  } finally {
    t.cleanup();
  }
});
test("restricted PR creation leaves a reviewable branch and a concrete compare link", () => {
  const t = setup();
  try {
    assert.equal(t.run("review-signal.mjs").status, 0);
    const result = t.run("open-review.mjs", { DENY_PR: "1" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(t.dir, "summary.md"), "utf8"),
      /compare\/main\.\.\.atlas\/issue-42/,
    );
    assert.ok(t.calls().some((x) => x.route === "/git/refs"));
  } finally {
    t.cleanup();
  }
});
test("changed source or moved main aborts proposal before creating a branch", () => {
  const t = setup();
  try {
    assert.equal(t.run("review-signal.mjs").status, 0);
    let result = t.run("open-review.mjs", { MOVED: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Default branch changed/);
    fs.writeFileSync(
      path.join(t.dir, "fixture.json"),
      JSON.stringify({ ...fixture, body: "New contrary evidence" }),
    );
    result = t.run("open-review.mjs");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Issue changed/);
    assert.ok(!t.calls().some((x) => x.route === "/git/refs"));
  } finally {
    t.cleanup();
  }
});
