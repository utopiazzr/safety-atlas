import fs from "node:fs/promises";
import { github, artifact } from "./github.mjs";
import { analyzeCandidate, revisionOf } from "./review.mjs";
import {
  normalizeIssue,
  generateStoryboard,
  validateSignal,
} from "./signals.mjs";
const issueNumber = process.env.ATLAS_ISSUE_NUMBER;
if (!/^\d+$/.test(issueNumber || ""))
  throw Error("A numeric issue number is required");
const repo = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw Error("Invalid repository");
const { issue, comments } = await github().issueSnapshot(Number(issueNumber));
let candidate = normalizeIssue(issue, { comments });
const catalogue = JSON.parse(await fs.readFile("data/signals.json", "utf8"));
await artifact("review.json", {
  revision: revisionOf(issue, comments),
  ...analyzeCandidate(candidate, catalogue),
});
if (process.env.ATLAS_MODE === "storyboard")
  candidate = await generateStoryboard(candidate, {
    baseUrl: process.env.ATLAS_MODEL_BASE_URL,
    model: process.env.ATLAS_MODEL_ID,
    apiKey: process.env.ATLAS_MODEL_API_KEY,
  });
validateSignal(candidate);
await fs.mkdir("work/candidate", { recursive: true });
await fs.writeFile(
  "work/candidate/signal.json",
  JSON.stringify(candidate, null, 2) + "\n",
);
console.log(
  `Prepared ${candidate.id}; review=pending; storyboard=${candidate.storyboardStatus || "not-requested"}. No publication performed.`,
);
