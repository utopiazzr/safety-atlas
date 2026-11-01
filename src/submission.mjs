import { kindLabels, intents, provenance } from "./intake.mjs";
export const kinds = kindLabels;
export function validRepo(repo) {
  return (
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) && !repo.includes("..")
  );
}
export function fenced(text) {
  const runs = text.match(/`+/g) || [];
  const fence = "`".repeat(Math.max(3, ...runs.map((x) => x.length + 1)));
  return `${fence}\n${text}\n${fence}`;
}
export function signalTitle(form, files = []) {
  return (
    form.title.trim() ||
    form.note.trim().split("\n")[0] ||
    files[0]?.name ||
    "一段待探索的代码"
  ).slice(0, 100);
}
export function hasSignal(form, files = []) {
  return Boolean(form.note.trim() || form.code.trim() || files.length);
}
export function makeMarkdown(form, files = []) {
  const parts = [
    `## ${kinds[form.kind] || kinds.suspicion}\n\n状态：社区投稿，尚待核验。\n材料形式：${form.resourceType || "mixed"}`,
  ];
  const metadata = {
    version: 1,
    kind: Object.hasOwn(kinds, form.kind) ? form.kind : "suspicion",
    intent: Object.hasOwn(intents, form.intent) ? form.intent : "new",
    provenance: Object.hasOwn(provenance, form.provenance)
      ? form.provenance
      : "unsure",
    relatedId: /^[a-z0-9-]{1,100}$/.test(form.relatedId || "")
      ? form.relatedId
      : "",
  };
  parts.unshift(`<!-- safety-atlas:intake ${JSON.stringify(metadata)} -->`);
  parts.push(
    `目的：${intents[metadata.intent]}\n得知方式：${provenance[metadata.provenance]}${metadata.relatedId ? `\n关联档案：${metadata.relatedId}` : ""}`,
  );
  if (form.note.trim()) parts.push(form.note.trim());
  if (form.context?.trim()) parts.push(`## 运行条件\n\n${form.context.trim()}`);
  if (form.code.trim())
    parts.push(`## 代码（仅供审阅）\n\n${fenced(form.code)}`);
  for (const file of files.filter((f) => typeof f.content === "string"))
    parts.push(
      `## 文本附件\n\n${fenced(file.name)}\n\n${fenced(file.content)}`,
    );
  const media = files.filter((f) => typeof f.content !== "string");
  if (media.length)
    parts.push(
      `## 待附加材料\n\n以下文件仅在本机预览，尚未上传。提交者请在 GitHub 编辑框中附上原文件后删除本提示。\n\n${media.map((f) => fenced(f.name + " (" + f.size + " bytes)")).join("\n\n")}`,
    );
  parts.push(
    "---\n来自 Safety Atlas 的待核验投稿。投稿类型不代表真实性结论。请在公开提交前移除敏感信息。",
  );
  return parts.join("\n\n");
}
export function makeIssueUrl(repo, form, files = []) {
  if (!validRepo(repo)) return null;
  const url = new URL(`https://github.com/${repo}/issues/new`);
  url.searchParams.set("template", "web-signal.md");
  url.searchParams.set(
    "title",
    `[${kinds[form.kind] || kinds.suspicion}] ${signalTitle(form, files)}`,
  );
  url.searchParams.set("body", makeMarkdown(form, files));
  return url.href.length <= 7500 ? url.href : null;
}
export function handoffUrl(repo, form, files = []) {
  if (!validRepo(repo)) return null;
  return (
    makeIssueUrl(repo, form, files) ||
    `https://github.com/${repo}/issues/new?template=web-signal.md&title=${encodeURIComponent(`[${kinds[form.kind] || kinds.suspicion}] ${signalTitle(form, files)}`)}`
  );
}
