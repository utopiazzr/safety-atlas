import { createHash } from "node:crypto";
import { normalizeIssue, webUrl } from "./signals.mjs";
import { analyzeCandidate } from "./review.mjs";
export const INTAKE =
  "https://safety-atlas-intake.aurora-scarf-6347.chatgpt.site";
export function recordReference(issue) {
  if (issue.user?.login !== "github-actions[bot]" || issue.pull_request)
    throw Error("Use a bridge-created public proposal");
  const match = issue.body?.match(
    /^<!-- safety-atlas:cloud ([a-f0-9-]{36}) -->\n\n<!-- safety-atlas:public-record ([a-f0-9]{64}) -->/,
  );
  if (
    !match ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      match[1],
    )
  )
    throw Error("Missing immutable public record");
  return { id: match[1], hash: match[2] };
}
export function prepareCommunity(issue, comments, record, catalogue) {
  const ref = recordReference(issue);
  if (
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !==
    ref.hash
  )
    throw Error("Public record changed; review the current record manually");
  if (
    !["community", "curated"].includes(record.disclosure) ||
    typeof record.title !== "string" ||
    !record.title.trim() ||
    record.title.length > 200 ||
    typeof record.summary !== "string" ||
    !record.summary.trim() ||
    record.summary.length > 1000 ||
    !Array.isArray(record.sources) ||
    !record.sources.length ||
    record.sources.length > 10 ||
    record.sources.some((s) => !webUrl(s))
  )
    throw Error("Incomplete public proposal");
  const candidate = normalizeIssue(issue, { comments });
  const analysis = analyzeCandidate(candidate, catalogue);
  if (record.intent === "new" && analysis.matches.length)
    throw Error(
      "Possible existing entry: " +
        analysis.matches.map((m) => m.id).join(", ") +
        ". Use manual review to choose a supplement or a distinct entry.",
    );
  return {
    candidate,
    analysis,
    input: {
      decision: record.intent === "new" ? "draft-new" : "draft-update",
      target_id: record.relatedId,
      title: record.title,
      summary: record.intent === "evidence" ? "" : record.summary,
      source_url: record.sources[0],
      evidence_type: record.evidenceType,
      context: record.context,
      limitations: record.limitations,
      rationale:
        "Community curation requested after reading the public proposal. Source and uncertainty still require PR review.",
    },
    sources: record.sources,
  };
}
export function canCurate(permission) {
  return (
    ["admin", "maintain", "write", "triage"].includes(permission?.role_name) ||
    ["admin", "write"].includes(permission?.permission)
  );
}
