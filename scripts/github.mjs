import fs from "node:fs/promises";
export function github({
  repo = process.env.GITHUB_REPOSITORY,
  token = process.env.GITHUB_TOKEN,
  request = fetch,
} = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw Error("Invalid repository");
  async function api(path, method = "GET", body) {
    if ((path !== "" && !path.startsWith("/")) || path.includes(".."))
      throw Error("Invalid API path");
    const response = await request(
      `https://api.github.com/repos/${repo}${path}`,
      {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) {
      const error = new Error(
        `GitHub ${method} ${path.split("?")[0]} returned ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async function issueSnapshot(number) {
    if (!Number.isSafeInteger(Number(number)) || Number(number) < 1)
      throw Error("Invalid issue number");
    const issue = await api(`/issues/${number}`);
    if (issue.pull_request)
      throw Error("Use a community Issue, not a pull request");
    const comments = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await api(
        `/issues/${number}/comments?per_page=100&page=${page}`,
      );
      comments.push(...batch.filter((c) => c.user?.type !== "Bot"));
      if (batch.length < 100) return { issue, comments };
    }
    throw Error("Discussion exceeds 1000 comments; curate this Issue manually");
  }
  async function findComment(number, marker) {
    let previous;
    for (let page = 1; page <= 10; page++) {
      const batch = await api(
        `/issues/${number}/comments?per_page=100&page=${page}`,
      );
      previous = batch.find(
        (c) =>
          c.user?.login === "github-actions[bot]" && c.body?.startsWith(marker),
      );
      if (previous || batch.length < 100) break;
    }
    return previous;
  }
  async function comment(
    number,
    body,
    marker = "<!-- safety-atlas:status -->",
  ) {
    const previous = await findComment(number, marker);
    const content = { body: `${marker}\n${body}` };
    return previous
      ? api(`/issues/comments/${previous.id}`, "PATCH", content)
      : api(`/issues/${number}/comments`, "POST", content);
  }
  async function status(number, value) {
    const issue = await api(`/issues/${number}`);
    const name = `atlas:${value}`;
    try {
      await api("/labels", "POST", {
        name,
        color:
          value === "published"
            ? "227766"
            : value === "needs-info"
              ? "b78636"
              : "4b5964",
        description: "Safety Atlas editorial status / 投稿处理状态",
      });
    } catch (e) {
      if (e.status !== 422) throw e;
    }
    await api(`/issues/${number}/labels`, "POST", { labels: [name] });
    // Remove only workflow-owned statuses; retain all human labels, including concurrent additions.
    for (const label of issue.labels || [])
      if (
        [
          "received",
          "needs-info",
          "in-review",
          "duplicate",
          "declined",
          "published",
        ].some((s) => label.name === `atlas:${s}`) &&
        label.name !== name
      ) {
        try {
          await api(
            `/issues/${number}/labels/${encodeURIComponent(label.name)}`,
            "DELETE",
          );
        } catch (e) {
          if (e.status !== 404) throw e;
        }
      }
  }
  return { api, issueSnapshot, findComment, comment, status, repo };
}
export async function artifact(name, value) {
  await fs.mkdir("work/candidate", { recursive: true });
  await fs.writeFile(
    `work/candidate/${name}`,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
  );
}
export async function summary(value) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, value + "\n");
}
