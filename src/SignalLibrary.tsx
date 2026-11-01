import ScenePlayer from "./ScenePlayer";
import { PosterArt } from "./CosmicArt";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  X,
  Plus,
  Search,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import data from "../data/signals.json";
import { localize, useLocale, t } from "./i18n";
import { scenes } from "./scenes";
type Entry = (typeof data)[number];
const tabs = [
  ["all", "全部"],
  ["report", "案例"],
  ["attack", "攻击"],
  ["defense", "防御"],
  ["resource", "模型 / 产品"],
];
export default function SignalLibrary({
  onContribute,
  featured,
  motion,
}: {
  onContribute: (kind?: string) => void;
  featured: { id: string; seq: number };
  motion: boolean;
}) {
  useLocale();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Entry | null>(null),
    [saved, setSaved] = useState<string[]>(() => {
      try {
        const v = JSON.parse(
          localStorage.getItem("atlas-library-saved") || "[]",
        );
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
      } catch {
        return [];
      }
    });
  const dialog = useRef<HTMLDialogElement>(null),
    focus = useRef<HTMLElement | null>(null);
  const entries = data.filter((x) => x.review === "approved");
  const visible = entries.filter(
    (x) =>
      (filter === "all" ||
        x.kind === filter ||
        ("facets" in x && x.facets?.includes(filter))) &&
      [x.title, x.summary, t(x.title), t(x.summary)]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function open(entry: Entry) {
    focus.current = document.activeElement as HTMLElement;
    setSelected(entry);
  }
  function close() {
    setSelected(null);
  }
  useEffect(() => {
    if (featured.id) {
      const entry = entries.find((x) => x.id === featured.id);
      if (entry) open(entry);
    }
  }, [featured]);
  useEffect(() => {
    if (selected) {
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
      focus.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);
  function toggleSave(id: string) {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("atlas-library-saved", JSON.stringify(next));
    } catch {}
  }
  const scene = selected
    ? scenes[selected.id] || {
        nodes: ["来源", "模型", "操作", "结果"],
        steps: (
          selected.storyboard?.steps || [
            { title: "来源", body: selected.summary, sourceIndex: 0 },
            {
              title: "待核验",
              body: "依据公开来源整理的机制示意，非本站实测。",
              sourceIndex: 0,
            },
          ]
        ).map((s, i) => ({
          ...s,
          from: Math.min(i, 2),
          to: Math.min(i + 1, 3),
          signal: "neutral" as const,
        })),
      }
    : null;
  return localize(
    <section className="signal-library" id="signals">
      <span id="archive" />
      <div className="library-heading">
        <h2>发现。理解。连接。</h2>
        <button className="library-contribute" onClick={() => onContribute()}>
          <Plus size={21} />
          投递信号
        </button>
      </div>
      <div className="library-controls">
        <div className="library-tabs" aria-label="信号类型">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="library-search">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索信号"
            placeholder="搜索…"
          />
        </label>
      </div>
      <div className="poster-grid">
        {visible.map((entry, i) => (
          <article
            className={`signal-poster ${entry.kind} palette-${entry.id}`}
            key={entry.id}
          >
            <button
              className="poster-open"
              onClick={() => open(entry)}
              aria-label={`打开 ${entry.title}`}
            >
              <div className="poster-top">
                <span className="poster-number">
                  {String(entries.indexOf(entry) + 1).padStart(2, "0")}
                </span>
                <span className="poster-category">
                  {tabs.find(([id]) => id === entry.kind)?.[1] || "线索"}
                </span>
              </div>
              <PosterArt id={entry.id} kind={entry.kind} />
              <div className="poster-title">
                <h3>
                  {entry.id === "echoleak"
                    ? "EchoLeak"
                    : entry.id === "whatsapp-mcp"
                      ? "WhatsApp MCP"
                      : entry.title}
                </h3>
                <span>↗</span>
              </div>
            </button>
          </article>
        ))}
        <button
          className="poster-invite"
          onClick={() => onContribute(filter === "all" ? "suspicion" : filter)}
        >
          <span>+</span>
          <strong>
            还有一束
            <br />
            来自你。
          </strong>
        </button>
      </div>
      {!visible.length && (
        <p className="empty-results">没有匹配的信号。试试别的关键词。</p>
      )}
      <dialog
        ref={dialog}
        className="signal-detail"
        aria-labelledby="signal-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="detail-wrap">
          {selected && scene && (
            <>
              <div className="detail-top">
                <span>
                  {(
                    {
                      "vendor-advisory": "厂商通告",
                      "research-poc": "研究演示",
                      paper: "研究论文",
                      project: "开源工具",
                      "model-card": "模型卡",
                    } as Record<string, string>
                  )[selected.evidenceType] || "待核验"}
                </span>
                <button
                  className="icon-btn"
                  aria-label="关闭窗口"
                  onClick={close}
                >
                  <X size={23} />
                </button>
              </div>
              <h2 id="signal-title">{selected.title}</h2>
              <ScenePlayer
                key={selected.id}
                caseId={selected.id}
                scene={scene}
                motion={motion}
              />
              <div className="detail-disclosures">
                <details>
                  <summary>
                    来源与证据 <ExternalLink size={15} />
                  </summary>
                  <p>依据公开来源整理的机制示意，非本站实测。</p>
                  {selected.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.label}
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                  {"storyboard" in selected && selected.storyboard && (
                    <p>{selected.storyboard.disclaimer}</p>
                  )}
                </details>
                <details>
                  <summary>
                    相关资源 <ArrowUpRight size={15} />
                  </summary>
                  {selected.resources
                    .filter((r) => "url" in r && r.url)
                    .map((r, i) => (
                      <a
                        key={i}
                        href={"url" in r ? String(r.url) : undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.label || r.type}
                        <ArrowUpRight size={16} />
                      </a>
                    ))}
                  {selected.relationships.map((relation) => {
                    const related = entries.find(
                      (e) => e.id === relation.target,
                    );
                    return related ? (
                      <button
                        className="related-signal"
                        key={relation.target}
                        onClick={() => open(related)}
                      >
                        {related.title}
                        <ArrowUpRight size={16} />
                      </button>
                    ) : null;
                  })}
                </details>
                <details>
                  <summary>
                    条件与局限 <Plus size={15} />
                  </summary>
                  <dl>
                    {Object.entries(selected.environment || {}).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt>
                            {(
                              {
                                product: "对象",
                                versions: "版本",
                                access: "访问条件",
                                entryPoint: "入口",
                                requirements: "依赖",
                              } as Record<string, string>
                            )[key] || key}
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  {selected.limitations.map((x) => (
                    <p key={x}>{x}</p>
                  ))}
                  {"lifecycle" in selected && selected.lifecycle && (
                    <p>
                      {selected.lifecycle.disclosedAt} ·{" "}
                      {selected.lifecycle.fixStatus}
                    </p>
                  )}
                </details>
              </div>
              <div className="detail-actions">
                <button
                  onClick={() => toggleSave(selected.id)}
                  aria-pressed={saved.includes(selected.id)}
                >
                  <Bookmark
                    size={17}
                    fill={saved.includes(selected.id) ? "currentColor" : "none"}
                  />
                  {saved.includes(selected.id) ? "已收藏" : "收藏案例"}
                </button>
                <button
                  onClick={() => {
                    const kind = selected.kind;
                    close();
                    onContribute(kind);
                  }}
                >
                  补充线索
                  <Plus size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </section>,
  );
}
