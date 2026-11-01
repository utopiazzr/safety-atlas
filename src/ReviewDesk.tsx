import { useState } from "react";
import { ArrowUpRight, RefreshCw, Radio } from "lucide-react";
import { localize, useLocale } from "./i18n";
type Issue = {
  number: number;
  title: string;
  html_url: string;
  pull_request?: unknown;
  labels: { name: string }[];
};
const labels: Record<string, string> = {
  received: "已接收",
  "needs-info": "待补证",
  "in-review": "整理中",
  duplicate: "已关联",
  declined: "暂不收录",
  published: "已入目录",
};
export default function ReviewDesk({ repository }: { repository: string }) {
  useLocale();
  const [issues, setIssues] = useState<Issue[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const root = `https://github.com/${repository}`;
  async function load() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/issues?state=all&sort=updated&direction=desc&per_page=30`,
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data)) throw Error();
      setIssues(
        data.filter(
          (x) =>
            !x.pull_request &&
            typeof x.title === "string" &&
            x.html_url === `${root}/issues/${x.number}`,
        ),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return localize(
    <section className="review-desk" id="review">
      <details>
        <summary>
          <Radio size={20} />
          <span>从线索，到档案。</span>
          <span>投稿进度与维护入口</span>
          <ArrowUpRight size={20} />
        </summary>
        <div className="review-body">
          <ol className="review-route">
            <li>
              <b>01</b>交材料
            </li>
            <li>
              <b>02</b>核对与补证
            </li>
            <li>
              <b>03</b>审核变更
            </li>
            <li>
              <b>04</b>进入目录
            </li>
          </ol>
          <div className="review-links">
            <a
              href={`${root}/issues?q=is%3Aissue%20author%3A%40me`}
              target="_blank"
              rel="noreferrer"
            >
              我的投稿 ↗
            </a>
            <a href={`${root}/issues`} target="_blank" rel="noreferrer">
              全部投稿 ↗
            </a>
            <button onClick={load} disabled={busy}>
              <RefreshCw size={14} />
              {busy ? "读取中…" : "查看最近进度"}
            </button>
          </div>
          <div role="status">
            {error ? (
              <p>暂时无法读取 GitHub；可以直接打开全部投稿。</p>
            ) : issues?.length === 0 ? (
              <p>还没有社区投稿。首批公开资料由维护者整理。</p>
            ) : null}
          </div>
          {!error && issues && issues.length > 0 && (
            <ul className="review-issues">
              {issues.slice(0, 10).map((issue) => (
                <li key={issue.number}>
                  <a href={issue.html_url} target="_blank" rel="noreferrer">
                    <span>#{issue.number}</span>
                    <strong>{issue.title}</strong>
                    <em>
                      {labels[
                        issue.labels
                          .find((l) => l.name.startsWith("atlas:"))
                          ?.name.slice(6) || ""
                      ] || "等待接收"}
                    </em>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {issues && issues.length > 10 && (
            <p>这里只展示最近十条，完整记录见 GitHub。</p>
          )}
          <details className="maintainer-links">
            <summary>维护者入口</summary>
            <p>需要仓库写入权限。审核发生在 GitHub，所有决定留有记录。</p>
            <a
              href={`${root}/actions/workflows/review-signal.yml`}
              target="_blank"
              rel="noreferrer"
            >
              整理与审核 ↗
            </a>
            <a href={`${root}/pulls`} target="_blank" rel="noreferrer">
              待审变更 ↗
            </a>
            <a
              href={`${root}/blob/main/docs/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
            >
              维护指南 ↗
            </a>
          </details>
        </div>
      </details>
    </section>,
  );
}
