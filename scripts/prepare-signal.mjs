import fs from "node:fs/promises";
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
const response = await fetch(
  `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
  {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    },
    signal: AbortSignal.timeout(20000),
  },
);
if (!response.ok) throw Error(`Unable to read issue (${response.status})`);
const issue = await response.json();
if (issue.pull_request) throw Error("Use an Issue, not a pull request");
let candidate = normalizeIssue(issue);
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
