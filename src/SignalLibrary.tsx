import { PosterArt } from "./CosmicArt";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  X,
  Plus,
  Search,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import data from "../data/signals.json";
import { localize, useLocale, t } from "./i18n";
import { scenes, type Scene } from "./scenes";
type Entry = (typeof data)[number];
const tabs = [
  ["all", "全部"],
  ["report", "案例"],
  ["attack", "攻击"],
  ["defense", "防御"],
  ["resource", "模型 / 产品"],
];
function ProcessScene({
  scene,
  step,
  playing,
  onAdvance,
  motion,
}: {
  scene: Scene;
  step: number;
  playing: boolean;
  onAdvance: () => void;
  motion: boolean;
}) {
  useLocale();
  const [progress, setProgress] = useState(0);
  const advance = useRef(onAdvance);
  advance.current = onAdvance;
  useEffect(() => {
    setProgress(0);
    if (!playing) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 2400);
      setProgress(p);
      if (p === 1) advance.current();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, playing]);
  const event = scene.steps[step];
  const points = scene.nodes.map((_, i) => ({
    x: 65 + (i * 470) / Math.max(1, scene.nodes.length - 1),
    y: i % 2 === 0 ? 105 : 145,
  }));
  const from = points[event.from],
    to = points[event.to];
  const q = motion ? (playing ? progress : 1) : 1;
  const ease = q * q * (3 - 2 * q);
  const mx = (from.x + to.x) / 2,
    my = Math.min(from.y, to.y) - 55;
  const px =
      (1 - ease) * (1 - ease) * from.x +
      2 * (1 - ease) * ease * mx +
      ease * ease * to.x,
    py =
      (1 - ease) * (1 - ease) * from.y +
      2 * (1 - ease) * ease * my +
      ease * ease * to.y;
  return localize(
    <div className={`process-scene ${event.signal}`}>
      <svg viewBox="0 0 600 245" role="img" aria-label={event.title}>
        <defs>
          <linearGradient id="node-chrome" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fff1c9" />
            <stop offset=".25" stopColor="#9ba895" />
            <stop offset=".48" stopColor="#eff0d8" />
            <stop offset=".51" stopColor="#2c4c45" />
            <stop offset=".75" stopColor="#c3d5b8" />
            <stop offset="1" stopColor="#f4e8c0" />
          </linearGradient>
          <pattern
            id="scene-grid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M25 0H0V25"
              stroke="currentColor"
              strokeWidth=".4"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="600" height="245" fill="url(#scene-grid)" opacity=".13" />
        <ellipse
          cx="300"
          cy="125"
          rx="275"
          ry="103"
          fill="none"
          stroke="#b7ca9d"
          strokeWidth=".6"
          opacity=".3"
        />
        <path
          d="M10 235 300 25 590 235M80 235 300 25 520 235M170 235 300 25 430 235"
          stroke="#9cba7f"
          opacity=".13"
          fill="none"
        />
        <path
          d="M22 40A24 24 0 0 1 70 40"
          stroke="#c2cc9e"
          fill="none"
          strokeWidth="2"
        />
        <path
          d="M46 40h21"
          transform={`rotate(${-180 + progress * 180} 46 40)`}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="46" cy="40" r="3" fill="currentColor" />
        <path
          d={points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")}
          fill="none"
          stroke="#697b64"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        {event.signal !== "neutral" && (
          <>
            <rect
              x={(from.x + to.x) / 2 - 3}
              y="55"
              width="6"
              height="140"
              fill="currentColor"
              opacity=".25"
            />
            <path
              d={`M${(from.x + to.x) / 2} 55V195`}
              stroke="currentColor"
              strokeDasharray="5 5"
            />
          </>
        )}
        <path
          d={`M${from.x} ${from.y}Q${mx} ${my} ${to.x} ${to.y}`}
          stroke="currentColor"
          strokeWidth="3"
          opacity=".6"
          fill="none"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="33" fill="url(#node-chrome)" />
            <circle
              cx={p.x}
              cy={p.y}
              r="26"
              fill="#15251c"
              stroke={i === event.to ? "currentColor" : "#7f9176"}
              strokeWidth={i === event.to ? 3 : 1}
            />
            <text
              x={p.x}
              y={p.y + 6}
              textAnchor="middle"
              className="scene-number"
            >
              {String(i + 1).padStart(2, "0")}
            </text>
            <foreignObject x={p.x - 48} y={p.y + 38} width="96" height="45">
              <div className="scene-label">{scene.nodes[i]}</div>
            </foreignObject>
          </g>
        ))}
        <path
          d={`M${px} ${py - 12}L${px + 5} ${py - 4}L${px + 14} ${py}L${px + 5} ${py + 4}L${px} ${py + 12}L${px - 5} ${py + 4}L${px - 14} ${py}L${px - 5} ${py - 4}Z`}
          fill="currentColor"
        />
        <circle cx={px} cy={py} r="4" fill="#fff1c9" />
        <circle
          cx={px}
          cy={py}
          r="17"
          fill="none"
          stroke="currentColor"
          opacity=".3"
        />
        <path
          d={`m${px - 4} ${py - 4} 8 4-8 4`}
          stroke="#13231a"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      <span className="scene-caption">
        {event.signal === "risk"
          ? "越过边界"
          : event.signal === "check"
            ? "检查位置"
            : "信号流动"}
      </span>
    </div>,
  );
}
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
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
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
    setStep(0);
    setPlaying(false);
  }
  function close() {
    setSelected(null);
    setPlaying(false);
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
              <ProcessScene
                scene={scene}
                step={step}
                playing={playing}
                motion={motion}
                onAdvance={() => {
                  if (step < scene.steps.length - 1) setStep((s) => s + 1);
                  else setPlaying(false);
                }}
              />
              <div className="scene-controls">
                <button
                  className="scene-play"
                  aria-label={playing ? "暂停演示" : "播放演示"}
                  onClick={() => {
                    if (step === scene.steps.length - 1) setStep(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={19} /> : <Play size={19} />}
                </button>
                <div className="scene-steps">
                  {scene.steps.map((s, i) => (
                    <button
                      key={i}
                      className={step === i ? "active" : ""}
                      aria-label={`第${i + 1}步：${s.title}`}
                      aria-pressed={step === i}
                      onClick={() => {
                        setStep(i);
                        setPlaying(false);
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  className="icon-btn"
                  aria-label="上一步"
                  disabled={step === 0}
                  onClick={() => {
                    setStep((s) => s - 1);
                    setPlaying(false);
                  }}
                >
                  <ArrowLeft size={19} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="下一步"
                  disabled={step === scene.steps.length - 1}
                  onClick={() => {
                    setStep((s) => s + 1);
                    setPlaying(false);
                  }}
                >
                  <ArrowRight size={19} />
                </button>
              </div>
              <div className="stage-caption" aria-live="polite">
                <span>{String(step + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{scene.steps[step].title}</h3>
                  <p>{scene.steps[step].body}</p>
                </div>
              </div>
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
