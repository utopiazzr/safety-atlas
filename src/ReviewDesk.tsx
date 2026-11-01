import { useState } from "react";
import {
  ArrowUpRight,
  RefreshCw,
  Users,
  GitPullRequest,
  MessageCircle,
  Plus,
} from "lucide-react";
import { localize, useLocale } from "./i18n";
import { INTAKE_API, cloudRequest } from "./cloud-client.mjs";
type Proposal = {
  id: string;
  title: string;
  summary: string;
  sources: string[];
  kind: string;
  githubIssue: number | null;
  context?: string;
  limitations?: string;
};
type Issue = {
  number: number;
  title: string;
  html_url: string;
  pull_request?: unknown;
  labels: { name: string }[];
};
const states: Record<string, string> = {
  received: "待讨论",
  "needs-info": "待补证",
  "in-review": "草稿审阅中",
  duplicate: "已关联",
  declined: "暂不收录",
  published: "已入目录",
};
export default function ReviewDesk({ repository }: { repository: string }) {
  useLocale();
  const [proposals, setProposals] = useState<Proposal[] | null>(null),
    [issues, setIssues] = useState<Issue[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const root = `https://github.com/${repository}`;
  async function load() {
    setBusy(true);
    setError("");
    const results = await Promise.allSettled([
      cloudRequest("/api/community"),
      fetch(
        `https://api.github.com/repos/${repository}/issues?state=all&sort=updated&direction=desc&per_page=30`,
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(10000),
        },
      ).then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
    ]);
    const [cloud, github] = results;
    if (cloud.status === "fulfilled" && Array.isArray(cloud.value.items))
      setProposals(cloud.value.items);
    else setError("提案列表暂时无法读取，可打开 GitHub 协作区。");
    if (github.status === "fulfilled" && Array.isArray(github.value))
      setIssues(
        github.value.filter(
          (x) =>
            !x.pull_request &&
            typeof x.title === "string" &&
            x.html_url === `${root}/issues/${x.number}`,
        ),
      );
    else setError((e) => e || "GitHub 进度暂不可用；下方提案仍待核验。");
    setBusy(false);
  }
  const status = (number: number | null) => {
    const issue = issues.find((x) => x.number === number);
    return (
      Object.entries(states).find(([key]) =>
        issue?.labels.some((l) => l.name === `atlas:${key}`),
      )?.[1] || "尚未核验"
    );
  };
  return localize(
    <section className="review-desk community-desk" id="review">
      <div className="community-heading">
        <div>
          <span className="community-kicker">OPEN OBSERVATORY / 共同维护</span>
          <h2>档案，由大家续写。</h2>
        </div>
        <Users size={36} />
      </div>
      <div className="community-actions">
        <a href="#contribute">
          <Plus size={19} />
          自主提案
        </a>
        <a href={`${root}/issues`} target="_blank" rel="noreferrer">
          <MessageCircle size={19} />
          补证与讨论
          <ArrowUpRight size={15} />
        </a>
        <a href={`${root}/pulls`} target="_blank" rel="noreferrer">
          <GitPullRequest size={19} />
          审阅变更
          <ArrowUpRight size={15} />
        </a>
      </div>
      <p className="community-note">
        任何人都能提出新档案、补证或更正。公开提案尚未核验，审阅合并后才进入目录。
      </p>
      <div className="community-feed-head">
        <strong>社区提案</strong>
        <button onClick={load} disabled={busy}>
          <RefreshCw size={15} />
          {busy ? "读取中…" : "查看最近提案"}
        </button>
      </div>
      {error && <p role="status">{error}</p>}
      {proposals === null && !busy && !error && (
        <p className="community-empty">
          公开提案在这里接力，私密材料留在接收台。
        </p>
      )}
      {proposals?.length === 0 && (
        <p className="community-empty">
          还没有公开提案。第一束信号，等你发出。
        </p>
      )}
      <div className="community-proposals">
        {proposals?.map((p) => (
          <details key={p.id}>
            <summary>
              <span className="proposal-signal" aria-hidden="true">
                ◎
              </span>
              <strong>{p.title}</strong>
              <em>{status(p.githubIssue)}</em>
              <Plus size={16} />
            </summary>
            <div className="proposal-detail">
              <p>{p.summary}</p>
              {p.context && <p>{p.context}</p>}
              {p.limitations && <p>{p.limitations}</p>}
              <div className="proposal-sources">
                {p.sources.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    来源 {i + 1} ↗
                  </a>
                ))}
              </div>
              {p.githubIssue ? (
                <a
                  href={`${root}/issues/${p.githubIssue}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  加入讨论 ↗
                </a>
              ) : (
                <span>等待同步到 GitHub，约每小时一次。</span>
              )}
            </div>
          </details>
        ))}
      </div>
      {issues
        .filter((i) => !proposals?.some((p) => p.githubIssue === i.number))
        .slice(0, 8)
        .map((i) => (
          <a
            className="community-issue"
            href={i.html_url}
            key={i.number}
            target="_blank"
            rel="noreferrer"
          >
            <span>#{i.number}</span>
            <strong>{i.title}</strong>
            <em>{status(i.number)}</em>
            <ArrowUpRight size={14} />
          </a>
        ))}
      <details className="community-guide">
        <summary>如何共同维护</summary>
        <ol>
          <li>提出观察或修改建议，注明来源与不确定之处。</li>
          <li>社区核对来源、补充证据；相同事件优先补充已有档案。</li>
          <li>
            协作者添加 atlas:propose 标签，自动生成草稿 PR；审阅后合并发布。
          </li>
        </ol>
        <p>
          熟悉 GitHub？可直接 Fork → 修改 data/signals.json → 提交
          PR。自动检查结构与证据，提交的代码不会自动执行。
        </p>
        <div className="review-links">
          <a
            href={`${root}/blob/main/docs/CONTRIBUTING.md`}
            target="_blank"
            rel="noreferrer"
          >
            贡献指南 ↗
          </a>
          <a
            href={`${root}/actions/workflows/community-curate.yml`}
            target="_blank"
            rel="noreferrer"
          >
            协作者整理入口 ↗
          </a>
          <a href={`${INTAKE_API}/admin`} target="_blank" rel="noreferrer">
            私密接收台 ↗
          </a>
          <a href="#contribute">导入回执 / 查进度</a>
        </div>
      </details>
    </section>,
  );
}
