import { createHash } from "node:crypto";
import { canonicalUrl, webUrl } from "../src/intake.mjs";
import { validateSignal } from "./signals.mjs";
export const statuses = [
  "received",
  "needs-info",
  "in-review",
  "duplicate",
  "declined",
  "published",
];
export function revisionOf(issue, comments = []) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: issue.title,
        body: issue.body,
        comments: comments
          .filter((c) => c.user?.type !== "Bot")
          .map((c) => ({ id: c.id, body: c.body, updated: c.updated_at })),
      }),
    )
    .digest("hex");
}
export function analyzeCandidate(candidate, catalogue) {
  const links = new Set(
    [...candidate.sources, ...candidate.resources]
      .filter((r) => r.url)
      .map((r) => canonicalUrl(r.url)),
  );
  const matches = catalogue
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      reasons: [
        ...(candidate.intake?.relatedId === entry.id
          ? ["投稿者关联此档案"]
          : []),
        ...([...entry.sources, ...entry.resources].some(
          (r) => r.url && links.has(canonicalUrl(r.url)),
        )
          ? ["包含相同来源链接"]
          : []),
      ],
    }))
    .filter((m) => m.reasons.length);
  const questions = [];
  if (candidate.intake?.missingAttachments)
    questions.push(
      "附件清单仍标记尚未上传，请检查 GitHub 中是否已附上原文件。",
    );
  if (
    candidate.intake?.relatedId &&
    !catalogue.some((e) => e.id === candidate.intake.relatedId)
  )
    questions.push("关联档案 ID 不存在，请确认补充对象。");
  if (candidate.intake?.intent !== "new" && !candidate.intake?.relatedId)
    questions.push("补充或更正需要指明原档案。");
  if (
    candidate.sources.length < 2 &&
    !candidate.resources.some((r) =>
      ["image", "video", "code"].includes(r.type),
    )
  )
    questions.push("可补充原始链接、截图、日志或观察经过；线索仍会被接收。");
  if (candidate.intake?.discussionPartial)
    questions.push("讨论较长，候选仅附部分评论；审核前请阅读完整 Issue。");
  if (candidate.intake?.materialsPartial)
    questions.push(
      "材料较多，候选仅提取部分资源；请从原帖手工整理 PR，避免遗漏。",
    );
  const prompts = {
    suspicion: "区分观察与推测；尚未知道原因也可以保留为线索。",
    incident: "记录发生时间、产品版本、权限、实际观察与脱敏证据。",
    report: "优先核对一手披露、报道日期、受影响版本与后续修复。",
    attack: "记录论文或代码、目标模型、访问方式、预算及适用限制。",
    defense: "记录接入位置、配置前提、评测环境、误报或绕过限制。",
    resource: "记录仓库或模型卡、版本、许可证、接入方式与能力边界。",
  };
  return {
    matches,
    questions,
    prompt: prompts[candidate.kind],
    suggestedStatus: questions.length ? "needs-info" : "received",
  };
}
function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function createProposal(
  candidate,
  catalogue,
  input,
  { actor, revision, now = new Date().toISOString() } = {},
) {
  const update = input.decision === "draft-update",
    existing = update ? catalogue.find((e) => e.id === input.target_id) : null;
  if (update && !existing)
    throw Error("Updating requires an existing target_id");
  if (!["draft-new", "draft-update"].includes(input.decision))
    throw Error("Not a publication proposal");
  if (!webUrl(input.source_url))
    throw Error("A primary source URL is required");
  if (!String(input.rationale || "").trim())
    throw Error("Explain the curation decision");
  if (
    !update &&
    (!String(input.title || "").trim() || !String(input.summary || "").trim())
  )
    throw Error("New entries require a title and summary");
  if (candidate.intake?.missingAttachments)
    throw Error(
      "Resolve the pending attachment notice in the Issue before proposing publication",
    );
  if (candidate.intake?.materialsPartial || candidate.intake?.discussionPartial)
    throw Error(
      "Candidate contains partial evidence; curate the full Issue manually in a PR",
    );
  if (!update && catalogue.some((e) => e.id === candidate.id))
    throw Error("An entry for this Issue exists; use draft-update");
  if (!update && candidate.intake?.intent !== "new")
    throw Error(
      "Supplements and corrections must use draft-update with a target",
    );
  const source = { url: input.source_url, label: "维护者核对的来源" };
  const sources = existing
    ? [...existing.sources]
    : [{ url: candidate.intake.issueUrl, label: "社区投稿与审核讨论" }];
  if (!sources.some((s) => canonicalUrl(s.url) === canonicalUrl(source.url)))
    sources.push(source);
  if (sources.length > 20)
    throw Error("Too many sources; curate the existing entry manually");
  const submission = {
    issueNumber: candidate.intake.issueNumber,
    issueUrl: candidate.intake.issueUrl,
    intent: candidate.intake.intent,
    revision,
    reviewedBy: actor,
    reviewedAt: now,
    rationale: String(input.rationale).trim(),
  };
  const entry = existing
    ? structuredClone(existing)
    : {
        schemaVersion: "1.0",
        id: candidate.id,
        kind: candidate.kind,
        title: input.title.trim(),
        summary: input.summary.trim(),
        verification: "source-linked",
        review: "approved",
        evidenceType: input.evidence_type,
        resources: candidate.resources.filter((r) => r.type !== "text"),
        relationships: [],
        storyboard: null,
      };
  entry.sources = sources;
  entry.checkedAt = now.slice(0, 10);
  entry.submission = submission;
  entry.review = "approved";
  if (update && input.summary?.trim()) entry.summary = input.summary.trim();
  if (input.context?.trim())
    entry.environment = {
      ...(entry.environment || {}),
      requirements: input.context.trim(),
    };
  entry.limitations = [
    ...new Set([...(entry.limitations || []), ...lines(input.limitations)]),
  ];
  if (!entry.limitations.length)
    entry.limitations = [
      "本条目依据公开来源整理，本站未独立复现；适用条件以来源为准。",
    ];
  if (update) {
    const resources = [
      ...entry.resources,
      ...candidate.resources.filter((r) => r.type !== "text"),
    ];
    entry.resources = resources.filter(
      (r, i) =>
        resources.findIndex((other) =>
          r.url
            ? canonicalUrl(other.url) === canonicalUrl(r.url)
            : other.content === r.content && other.type === r.type,
        ) === i,
    );
    entry.curationHistory = [
      ...(entry.curationHistory || []),
      ...(existing.submission ? [existing.submission] : []),
    ].slice(-20);
    // An updated claim invalidates the previously curated animation and reproduction badge.
    if (candidate.intake.intent === "correction" || input.summary?.trim()) {
      entry.storyboard = null;
      entry.visualizationStatus = "needs-review";
      if (entry.verification === "verified")
        entry.verification = "source-linked";
    }
  }
  validateSignal(entry, { publish: true });
  return {
    entry,
    catalogue: update
      ? catalogue.map((e) => (e.id === entry.id ? entry : e))
      : [...catalogue, entry],
    submission,
  };
}
export function validateCatalogue(entries) {
  if (!Array.isArray(entries)) throw Error("Catalogue must be an array");
  const ids = new Set(entries.map((x) => x.id));
  if (ids.size !== entries.length) throw Error("Duplicate entry IDs");
  for (const entry of entries) {
    validateSignal(entry, { publish: true });
    for (const relation of entry.relationships)
      if (!ids.has(relation.target))
        throw Error("Relationship target does not exist");
    if (entry.verification === "verified" && !webUrl(entry.reproduction?.url))
      throw Error(
        "Verified entries require an independent reproduction record",
      );
    if (
      entry.submission &&
      (!webUrl(entry.submission.issueUrl) ||
        !Number.isInteger(entry.submission.issueNumber) ||
        !entry.submission.reviewedBy ||
        !/^[a-f0-9]{64}$/.test(entry.submission.revision))
    )
      throw Error("Invalid review provenance");
  }
  return entries;
}
