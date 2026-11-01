import { recordReference } from "./community.mjs";

export const AUTO_ATTEMPTED = "atlas:auto-attempted";
export function automaticMode(env = process.env) {
  if (env.ATLAS_AUTOMATIC_PROPOSAL !== "true") return false;
  if (
    !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_WORKFLOW_REF !==
      `${env.GITHUB_REPOSITORY}/.github/workflows/community-drafts.yml@refs/heads/main`
  )
    throw Error("Automatic drafts require the trusted main workflow");
  return true;
}
export function eligibleAutomaticIssue(issue) {
  if (
    issue.state !== "open" ||
    !Number.isSafeInteger(issue.number) ||
    issue.number < 1
  )
    return false;
  const labels = (issue.labels || []).map((x) => x.name);
  if (
    !labels.includes("atlas:received") ||
    labels.some((x) =>
      [
        AUTO_ATTEMPTED,
        "atlas:needs-info",
        "atlas:in-review",
        "atlas:declined",
        "atlas:duplicate",
        "atlas:published",
        "atlas:hold",
      ].includes(x),
    )
  )
    return false;
  try {
    recordReference(issue);
    return true;
  } catch {
    return false;
  }
}
export function chooseAutomaticIssue(issues, pulls) {
  // Every bot PR counts towards the cap, including ones with edited descriptions.
  const botPRs = pulls.filter((p) => p.user?.login === "github-actions[bot]");
  if (botPRs.length >= 10) return null;
  const existing = new Set(
    botPRs.flatMap((p) =>
      [...String(p.body || "").matchAll(/^Source submission: #(\d+)$/gm)].map(
        (m) => Number(m[1]),
      ),
    ),
  );
  return (
    issues.find((i) => eligibleAutomaticIssue(i) && !existing.has(i.number)) ||
    null
  );
}
