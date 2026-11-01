export function validRepo(repo) {
  return (
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) && !repo.includes("..")
  );
}
export function makeMarkdown(form) {
  return `## 产品与版本\n${form.product.trim()}\n\n## 风险类型\n${form.category}\n\n## 事件经过\n${form.description.trim()}\n\n## 依据\n${form.evidence.trim()}\n\n---\n提交者确认：内容已脱敏，允许公开。尚待核验。`;
}
export function makeIssueUrl(repo, form) {
  if (!validRepo(repo)) return null;
  const url = new URL(`https://github.com/${repo}/issues/new`);
  url.searchParams.set("title", `[Case] ${form.title.trim()}`);
  url.searchParams.set("body", makeMarkdown(form));
  // Browsers and proxies vary. Do not silently truncate the user's evidence.
  return url.href.length <= 7500 ? url.href : null;
}
