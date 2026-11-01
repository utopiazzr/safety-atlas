import fs from "node:fs/promises";
import { github, summary } from "./github.mjs";
import { intakeMetadata } from "../src/intake.mjs";
const base = "https://safety-atlas-intake.aurora-scarf-6347.chatgpt.site";
const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const oidcUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
if (
  oidcUrl.protocol !== "https:" ||
  !oidcUrl.hostname.endsWith(".actions.githubusercontent.com")
)
  throw Error("Unexpected OIDC endpoint");
oidcUrl.searchParams.set("audience", base);
const auth = await fetch(oidcUrl, {
  headers: {
    Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
  },
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
if (!auth.ok) throw Error(`OIDC request failed: ${auth.status}`);
const { value: token } = await auth.json();
async function cloud(path, method = "GET", body) {
  const r = await fetch(base + "/api/automation" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok)
    throw Error(`Cloud intake ${path.split("/")[1]} returned ${r.status}`);
  return r.json();
}
const queue = await cloud("/queue");
if (event.inputs?.action === "health") {
  await summary(
    `Cloud intake connected; ${queue.items.length} approved records await import.`,
  );
  process.exit(0);
}
const client = github();
const target = event.inputs?.submission_id;
if (
  target &&
  !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    target,
  )
)
  throw Error("Invalid submission UUID");
const items = target ? [{ id: target }] : queue.items;
// Bound work and recover after an Issue was created but its acknowledgement was lost.
async function existing(marker) {
  for (let page = 1; page <= 10; page++) {
    const batch = await client.api(
      `/issues?state=all&per_page=100&page=${page}`,
    );
    const match = batch.find(
      (i) =>
        !i.pull_request &&
        i.user?.login === "github-actions[bot]" &&
        i.body?.startsWith(marker),
    );
    if (match) return match;
    if (batch.length < 100) return null;
  }
  throw Error("Issue history exceeds safe scan limit; import manually");
}
const literal = (value) =>
  String(value || "")
    .replaceAll("<!--", "‹!--")
    .replaceAll("-->", "--›")
    .replaceAll("@", "＠");
let count = 0;
for (const { id } of items) {
  const record = await cloud(`/submissions/${id}/export`),
    marker = `<!-- safety-atlas:cloud ${id} -->`;
  let issue = record.githubIssue
    ? { number: record.githubIssue }
    : await existing(marker);
  if (!issue) {
    const meta = intakeMetadata(
      `<!-- safety-atlas:intake ${JSON.stringify(record)} -->`,
    );
    const body = [
      marker,
      `<!-- safety-atlas:intake ${JSON.stringify(meta)} -->`,
      "## 已审公开摘要 / Curated public summary",
      literal(record.summary),
      "## 原始来源 / Sources",
      ...record.sources.map(
        (url) => `- <${url.replaceAll(">", "%3E").replaceAll("<", "%3C")}>`,
      ),
      "## 条件 / Context",
      literal(record.context),
      "## 局限 / Limitations",
      literal(record.limitations),
      `Evidence class: ${record.evidenceType}`,
      `[审核摘要存档 / Curated record](${record.publicUrl})`,
      "原始投稿和附件留在私有接收区。此摘要通过公开审阅许可，尚不代表独立复现或目录收录。 / Original materials remain private. Editorial approval is not independent verification.",
    ].join("\n\n");
    issue = await client.api("/issues", "POST", {
      title: literal(record.title).slice(0, 200),
      body,
    });
  }
  await cloud(`/submissions/${id}/exported`, "POST", {
    issueNumber: issue.number,
  });
  await client.status(issue.number, "received");
  count++;
}
let deleted = 0;
for (let i = 0; i < 5; i++) {
  const result = await cloud("/cleanup", "POST", {});
  deleted += result.deleted;
  if (result.deleted < 5) break;
}
await summary(
  `Imported ${count} reviewed summaries. Cleaned ${deleted} expired raw submissions. No catalogue changes or merges were performed.`,
);
