import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Plus,
  Search,
  X,
  Play,
  Pause,
  ShieldCheck,
  Radio,
  ChevronLeft,
  ChevronRight,
  Download,
  Bookmark,
  Crosshair,
  Code2,
  Radar,
  Mail,
  Bot,
  Wrench,
  LockKeyhole,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { cases, type Case } from "./cases";
import { makeIssueUrl, validRepo } from "./submission.mjs";

const repository =
  import.meta.env.VITE_GITHUB_REPOSITORY || "utopiazzr/safety-atlas";
const repoUrl = validRepo(repository) ? `https://github.com/${repository}` : "";
const channels = ["全部信号", "提示注入", "权限越界", "数据泄露", "工具风险"];
const points = [
  { x: 33, y: 28 },
  { x: 72, y: 41 },
  { x: 39, y: 73 },
  { x: 65, y: 72 },
];
const initialForm = {
  product: "",
  title: "",
  description: "",
  evidence: "",
  category: "暂不确定",
};
type Form = typeof initialForm;

function Diagram({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 360 190"
      role="img"
      aria-label="案例的信号示意图"
      className="diagram"
    >
      <defs>
        <pattern
          id={`grid-${kind}`}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M20 0H0V20"
            fill="none"
            stroke="currentColor"
            strokeWidth=".5"
            opacity=".15"
          />
        </pattern>
      </defs>
      <rect width="360" height="190" fill={`url(#grid-${kind})`} />
      <circle
        cx="180"
        cy="95"
        r="70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".3"
      />
      <circle
        cx="180"
        cy="95"
        r="50"
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 5"
        opacity=".4"
      />
      {kind === "mail" ? (
        <>
          <path
            d="M115 58h130v82H115z"
            fill="var(--tile-bg)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="m116 59 64 49 64-49m-128 80 48-43m80 43-48-43"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="250" cy="57" r="21" fill="var(--tile-accent)" />
          <text
            x="250"
            y="64"
            textAnchor="middle"
            fill="var(--tile-bg)"
            fontSize="27"
          >
            !
          </text>
          <path
            d="M38 96h58m-13-8 13 8-13 8M265 110h57"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      ) : kind === "folder" ? (
        <>
          <path
            d="M111 55h55l15 17h66v75H111z"
            fill="var(--tile-bg)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M105 90h151l-12 57H93z"
            fill="var(--tile-bg)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path d="M278 25v142" stroke="currentColor" strokeDasharray="4 6" />
          <path
            className="packet-line"
            d="M228 48h77m-13-9 13 9-13 9"
            stroke="var(--tile-accent)"
            fill="none"
            strokeWidth="4"
          />
        </>
      ) : kind === "signal" ? (
        <>
          <path
            d="m150 153 30-92 30 92m-48-28h36m-30-23h24"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <circle cx="180" cy="56" r="9" fill="var(--tile-accent)" />
          <path
            d="M153 33a37 37 0 0 0 0 48m54-48a37 37 0 0 1 0 48M133 18a62 62 0 0 0 0 78m94-78a62 62 0 0 1 0 78"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <rect
            x="270"
            y="102"
            width="37"
            height="34"
            fill="var(--tile-accent)"
          />
          <path
            d="M280 102v-8a8 8 0 0 1 16 0v8"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
        </>
      ) : (
        <>
          <rect
            x="112"
            y="43"
            width="138"
            height="104"
            rx="12"
            fill="var(--tile-bg)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="m135 72 13 13-13 13m26 0h26m-51 24h90"
            stroke="currentColor"
            fill="none"
            strokeWidth="3"
          />
          <circle cx="225" cy="68" r="8" fill="var(--tile-accent)" />
          <path
            d="M76 78v-15m13 15V63m-20 15h27v18a13 13 0 0 1-27 0zM96 90h16m138 0h40v35"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
          />
        </>
      )}
      <path
        d="M11 22V11h11m316 0h11v11M11 168v11h11m316 0h11v-11"
        stroke="currentColor"
        fill="none"
      />
    </svg>
  );
}

export default function App() {
  const [channel, setChannel] = useState(0),
    [query, setQuery] = useState(""),
    [tuned, setTuned] = useState(0),
    [scanning, setScanning] = useState(false);
  const [motion, setMotion] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [favoriteOnly, setFavoriteOnly] = useState(false),
    [favorites, setFavorites] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("atlas-stars") || "[]").filter(
          (x: unknown) => typeof x === "string",
        );
      } catch {
        return [];
      }
    });
  const [modal, setModal] = useState<"case" | "submit" | null>(null),
    [selected, setSelected] = useState<Case>(cases[0]),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [defense, setDefense] = useState(false);
  const [form, setForm] = useState<Form>(initialForm),
    [formStep, setFormStep] = useState(0),
    [consent, setConsent] = useState(false),
    [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusBefore = useRef<HTMLElement | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("case");
    const c = cases.find((c) => c.id === id);
    if (c) {
      setSelected(c);
      setModal("case");
    }
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
  }, []);
  useEffect(() => {
    if (modal) {
      focusBefore.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
      focusBefore.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal]);
  useEffect(() => {
    if (!playing || modal !== "case") return;
    const t = setInterval(
      () =>
        setStep((s) => {
          if (s === 3) {
            setPlaying(false);
            return 3;
          }
          return s + 1;
        }),
      1800,
    );
    return () => clearInterval(t);
  }, [playing, modal]);
  function close() {
    setModal(null);
    setPlaying(false);
    const url = new URL(location.href);
    url.searchParams.delete("case");
    history.replaceState({}, "", url);
  }
  function openCase(c: Case) {
    setSelected(c);
    setStep(0);
    setPlaying(false);
    setDefense(false);
    setCopied(false);
    setModal("case");
    const url = new URL(location.href);
    url.searchParams.set("case", c.id);
    history.replaceState({}, "", url);
  }
  function openSubmit() {
    setNotice("");
    setModal("submit");
    setPlaying(false);
  }
  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("atlas-stars", JSON.stringify(next));
    } catch {
      /* optional preference */
    }
  }
  function capture() {
    if (scanning) return;
    setScanning(true);
    scanTimer.current = setTimeout(
      () => {
        setTuned((t) => (t + 1) % cases.length);
        setScanning(false);
      },
      motion ? 850 : 0,
    );
  }
  function saveDraft() {
    try {
      localStorage.setItem("atlas-draft", JSON.stringify(form));
      setNotice("已保存到此浏览器。不会上传；共享设备请勿保存敏感内容。");
    } catch {
      setNotice("浏览器无法保存，请下载草稿文件。");
    }
  }
  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem("atlas-draft") || "null");
      if (
        !d ||
        !Object.keys(initialForm).every((k) => typeof d[k] === "string")
      )
        throw Error();
      setForm(d);
      setNotice("已恢复本机草稿。");
    } catch {
      setNotice("没有可恢复的本机草稿。");
    }
  }
  function clearDraft() {
    try {
      localStorage.removeItem("atlas-draft");
      setNotice("本机草稿已移除。");
    } catch {
      setNotice("无法访问浏览器存储。");
    }
  }
  function download() {
    const payload = {
      schemaVersion: "0.1",
      type: "unverified-report",
      ...form,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "safety-atlas-case-draft.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("草稿文件已生成。下载不会公开或提交案例。");
  }
  function nextForm(e: React.FormEvent) {
    e.preventDefault();
    setFormStep((s) => Math.min(2, s + 1));
    setNotice("");
  }
  useEffect(() => setConsent(false), [form]);
  const issueUrl = makeIssueUrl(repository, form);
  const filtered = cases.filter(
    (c) =>
      (channel === 0 || c.category === channels[channel]) &&
      (!favoriteOnly || favorites.includes(c.id)) &&
      `${c.title}${c.subtitle}${c.product}${c.category}`.includes(query.trim()),
  );
  const active = cases[tuned];
  return (
    <div className={`site ${motion ? "" : "still"}`}>
      <header className="masthead">
        <a className="brand" href="./">
          <span className="brand-icon">
            <Radio size={24} />
          </span>
          <span>
            越界档案<small>SAFETY ATLAS / RESEARCH STATION</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <a href="#archive">探索档案</a>
          <button
            onClick={() => {
              setFavoriteOnly(!favoriteOnly);
              document
                .getElementById("archive")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            我的收藏 <sup>{favorites.length}</sup>
          </button>
          <a href={repoUrl} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={13} />
          </a>
        </nav>
        <button className="btn ink" onClick={openSubmit}>
          <Plus size={17} />
          提交信号
        </button>
      </header>
      <main>
        <section
          className="hero"
          onPointerMove={(e) => {
            if (!motion || e.pointerType === "touch") return;
            const box = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--px",
              `${(e.clientX - box.left) / box.width - 0.5}`,
            );
            e.currentTarget.style.setProperty(
              "--py",
              `${(e.clientY - box.top) / box.height - 0.5}`,
            );
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty("--px", "0");
            e.currentTarget.style.setProperty("--py", "0");
          }}
        >
          <div className="hero-meta mono">
            <span>
              <i className="status-dot" /> HUMAN × MACHINE × THE UNKNOWN
            </span>
            <span>观察站 001 / OPEN SIGNALS</span>
          </div>
          <div className="hero-text">
            <div className="mini-kicker">
              <span>来自未来的事故档案</span>
              <span className="star">✳</span>
            </div>
            <h1>
              未来已来。
              <br />
              <span>边界未定。</span>
            </h1>
            <p>
              追踪智能体越界的瞬间。
              <br />
              把每一次意外，变成下一次进步的坐标。
            </p>
            <div className="hero-buttons">
              <a href="#archive" className="btn cream">
                进入档案 <ArrowDown size={18} />
              </a>
              <button onClick={() => openCase(active)} className="outline-btn">
                体验事件回放 <Play size={15} />
              </button>
            </div>
            <div className="big-word mono">
              SAFETY
              <br />
              <span>ATLAS</span>
              <span className="word-star">✷</span>
            </div>
          </div>
          <div className="hero-art">
            <img
              src={`${import.meta.env.BASE_URL}observatory-chrome.webp`}
              alt="镜面铬金属机器人望向太空，环绕着朱红构成、卫星与轨道"
              fetchPriority="high"
            />
            <div className="art-corners">
              <span>SPECIMEN / A–01</span>
              <span>SYNTHETIC INTELLIGENCE</span>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-stamp">
              <span>BEYOND</span>
              <strong>
                THE
                <br />
                BOUNDARY
              </strong>
              <span>观察 · 理解 · 共建</span>
            </div>
          </div>
          <div className="hero-bottom mono">
            <span>
              <span className="cross">+</span> KEEP THE FUTURE OPEN.
            </span>
            <span>SCROLL TO RECEIVE TRANSMISSION ↓</span>
            <button
              onClick={() => {
                setMotion(!motion);
                setPlaying(false);
              }}
              aria-label={motion ? "暂停动态效果" : "开启动效"}
            >
              {motion ? <Pause size={13} /> : <Play size={13} />} MOTION{" "}
              {motion ? "ON" : "OFF"}
            </button>
          </div>
        </section>
        <section className="receiver" aria-label="交互式信号接收台">
          <div className="receiver-label">
            <Radio size={25} />
            <span className="mono">
              SIGNAL
              <br />
              RECEIVER
            </span>
            <span className="serial">RX–04</span>
          </div>
          <div className={`radar-screen ${scanning ? "scanning" : ""}`}>
            <div className="radar-rings" />
            <div className="radar-sweep" />
            {points.map((p, i) => (
              <button
                key={i}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={`radar-dot ${tuned === i ? "selected" : ""}`}
                onClick={() => setTuned(i)}
                aria-label={`接收信号 ${i + 1}：${cases[i].category}`}
                aria-pressed={tuned === i}
              >
                <span />
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
            <span className="radar-axis">N</span>
          </div>
          <div className="receiver-display" aria-live="polite">
            <div className="mono">
              <i className="status-dot" />
              {scanning
                ? "SCANNING…"
                : `SIGNAL LOCKED / ${String(tuned + 1).padStart(2, "0")}`}
            </div>
            <h2>{active.title}</h2>
            <p>{active.category} / 教学示意 / 4 步回放</p>
            <button className="receiver-open" onClick={() => openCase(active)}>
              解码这条信号 <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="receiver-controls">
            <button
              className={`tuning-knob ${scanning ? "turning" : ""}`}
              onClick={capture}
              disabled={scanning}
              aria-label="调频，捕获下一条信号"
            >
              <span />
              <Crosshair size={23} />
            </button>
            <span className="mono">TURN TO DISCOVER</span>
            <button
              className="capture-btn"
              onClick={capture}
              disabled={scanning}
            >
              {scanning ? "正在捕获" : "捕获下一条"} <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section id="archive" className="archive">
          <div className="section-head">
            <div>
              <p className="eyebrow">01 / THE ANOMALY ARCHIVE</p>
              <h2>
                每次越界，<span>都有迹可循。</span>
              </h2>
            </div>
            <div className="archive-note">
              <span className="mini-cross">✳</span>
              <p>
                拆开事件，找到信任边界。
                <br />
                当前 4 个案例为教学示意，非已核验事故。
              </p>
            </div>
          </div>
          <div className="frequency-panel">
            <div className="frequency-title">
              <span className="mono">TUNE THE FREQUENCY</span>
              <span>选择风险频段</span>
            </div>
            <div className="frequency">
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={channel}
                onChange={(e) => setChannel(Number(e.target.value))}
                aria-label="风险频段"
              />
              <div className="frequency-labels">
                {channels.map((ch, i) => (
                  <button
                    key={ch}
                    aria-pressed={channel === i}
                    onClick={() => setChannel(i)}
                  >
                    {ch}
                    <small className="mono">
                      {i === 0 ? "ALL" : `${80 + i * 8}.0`}
                    </small>
                  </button>
                ))}
              </div>
            </div>
            <div className="frequency-readout mono">
              <strong>{channel === 0 ? "ALL" : `${80 + channel * 8}.0`}</strong>
              <span>MHz / {channel === 0 ? "全频接收" : "已锁定"}</span>
            </div>
          </div>
          <div className="archive-toolbar">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="搜索档案"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索案例、产品或风险…"
              />
              {query && (
                <button aria-label="清空搜索" onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </label>
            <div>
              <button
                aria-pressed={favoriteOnly}
                className={`saved-filter ${favoriteOnly ? "active" : ""}`}
                onClick={() => setFavoriteOnly(!favoriteOnly)}
              >
                <Bookmark size={15} />
                只看收藏
              </button>
              <span className="mono result-count">
                {String(filtered.length).padStart(2, "0")} SIGNALS
              </span>
            </div>
          </div>
          <div className="cards">
            {filtered.map((c) => (
              <article className={`archive-card ${c.color}`} key={c.id}>
                <button className="card-main" onClick={() => openCase(c)}>
                  <div className="card-visual">
                    <div className="card-index mono">
                      <span>{c.id.replace("DEMO", "CASE")}</span>
                      <span>教学示意 ↗</span>
                    </div>
                    <Diagram kind={c.art} />
                    <div className="card-strip mono">
                      {c.category} / {c.product}
                    </div>
                  </div>
                  <div className="card-copy">
                    <h3>{c.title}</h3>
                    <p>{c.subtitle}</p>
                    <div className="card-foot">
                      <span>进入事件回放</span>
                      <span className="round-arrow">
                        <ArrowUpRight size={18} />
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  className="save-case"
                  onClick={() => toggleFavorite(c.id)}
                  aria-label={
                    favorites.includes(c.id)
                      ? `取消收藏：${c.title}`
                      : `收藏：${c.title}`
                  }
                  aria-pressed={favorites.includes(c.id)}
                >
                  <Bookmark
                    size={17}
                    fill={favorites.includes(c.id) ? "currentColor" : "none"}
                  />
                </button>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Radar size={40} />
              <h3>这个频段，暂时没有信号。</h3>
              <p>试试其他关键词，或者回到全部档案。</p>
              <button
                className="btn ink"
                onClick={() => {
                  setChannel(0);
                  setQuery("");
                  setFavoriteOnly(false);
                }}
              >
                重置接收器 <RotateCcw size={15} />
              </button>
            </div>
          )}
          <div className="endline mono">
            <span />
            END OF TRANSMISSION / MORE SIGNALS AHEAD
            <span />
          </div>
        </section>
        <section className="join">
          <div className="join-orbit" aria-hidden="true">
            <div />
            <span>✳</span>
          </div>
          <div>
            <p className="eyebrow">02 / BECOME AN OBSERVER</p>
            <h2>
              你的一次发现，
              <br />
              让未来少一次意外。
            </h2>
            <p>从一条线索开始。让证据流动，让知识开放。</p>
          </div>
          <button className="btn cream" onClick={openSubmit}>
            发射你的信号 <ArrowUpRight size={19} />
          </button>
        </section>
      </main>
      <footer>
        <a className="brand footer-brand" href="./">
          越界档案<span className="mono">SAFETY ATLAS</span>
        </a>
        <span>记录边界。保持好奇。</span>
        <a href={repoUrl} target="_blank" rel="noreferrer">
          <Code2 size={17} /> 在 GitHub 共建 <ArrowUpRight size={14} />
        </a>
        <span className="mono">EARTH, 2026.</span>
      </footer>
      <dialog
        className={modal === "case" ? "dossier" : "submit-dialog"}
        ref={dialog}
        aria-labelledby="modal-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="dialog-wrap">
          <button className="close" onClick={close} aria-label="关闭窗口">
            <X size={22} />
          </button>
          {modal === "case" && (
            <>
              <div className="dossier-head">
                <p className="eyebrow">DECODE / {selected.id} / 教学示意</p>
                <h2 id="modal-title">{selected.title}</h2>
                <p>{selected.intent}</p>
              </div>
              <div className="simulation">
                <div className="sim-top">
                  <span className="mono">
                    LIVE RECONSTRUCTION / 0{step + 1}
                  </span>
                  <button
                    className={`shield-switch ${defense ? "on" : ""}`}
                    aria-pressed={defense}
                    onClick={() => setDefense(!defense)}
                  >
                    <span className="switch-track">
                      <i />
                    </span>
                    {defense ? "防御视角已开启" : "开启防御视角"}
                  </button>
                </div>
                <div className={`signal-path ${defense ? "protected" : ""}`}>
                  <div className="path-line" />
                  <div
                    className="travel-packet"
                    style={
                      {
                        "--progress": `${step * 28 + 8}%`,
                      } as React.CSSProperties
                    }
                  />
                  {selected.steps.map((s, i) => {
                    const Icon = [Mail, Bot, Wrench, LockKeyhole][i];
                    return (
                      <button
                        key={s.title}
                        className={`path-node ${i <= step ? "passed" : ""} ${i === step ? "current" : ""}`}
                        aria-current={i === step ? "step" : undefined}
                        aria-label={`第${i + 1}步：${s.title}`}
                        onClick={() => {
                          setStep(i);
                          setPlaying(false);
                        }}
                      >
                        <span>
                          {defense && i === step ? (
                            <ShieldCheck size={28} />
                          ) : (
                            <Icon size={28} />
                          )}
                        </span>
                        <small className="mono">0{i + 1}</small>
                        <strong>{s.title}</strong>
                      </button>
                    );
                  })}
                </div>
                <div
                  className={`sim-story ${defense ? "safe" : ""}`}
                  aria-live="polite"
                >
                  <span className="story-number mono">0{step + 1}</span>
                  <div>
                    <p className="eyebrow">
                      {defense
                        ? "POSSIBLE INTERVENTION"
                        : "OBSERVED IN THIS SCENARIO"}
                    </p>
                    <h3>
                      {defense
                        ? "在这里，我们可以设一道边界。"
                        : selected.steps[step].title}
                    </h3>
                    <p>
                      {defense
                        ? selected.steps[step].defense
                        : selected.steps[step].body}
                    </p>
                  </div>
                  <span className="sim-symbol">{defense ? "⊕" : "↗"}</span>
                </div>
                <div className="playbar">
                  <button
                    className="btn orange compact"
                    onClick={() => {
                      if (step === 3) setStep(0);
                      setPlaying(!playing);
                    }}
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                    {playing ? "暂停" : step === 3 ? "重新回放" : "播放事件"}
                  </button>
                  <span className="mono">
                    {String(step + 1).padStart(2, "0")} / 04
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={step}
                    aria-label="事件回放进度"
                    onChange={(e) => {
                      setStep(Number(e.target.value));
                      setPlaying(false);
                    }}
                  />
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setStep(Math.max(0, step - 1));
                      setPlaying(false);
                    }}
                    disabled={step === 0}
                    aria-label="上一步"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setStep(Math.min(3, step + 1));
                      setPlaying(false);
                    }}
                    disabled={step === 3}
                    aria-label="下一步"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="dossier-bottom">
                <div>
                  <h3>信号背后</h3>
                  <p>{selected.outcome}</p>
                  <small>
                    原创教学示意。防御视角解释可能的措施，不代表已实测阻断。
                  </small>
                </div>
                <div className="case-actions">
                  <button
                    className="small-btn"
                    onClick={() => toggleFavorite(selected.id)}
                  >
                    <Bookmark size={16} />
                    {favorites.includes(selected.id) ? "已收藏" : "收藏案例"}
                  </button>
                  <button
                    className="small-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(location.href);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    <ExternalLink size={16} />
                    {copied ? "链接已复制" : "复制案例链接"}
                  </button>
                  <button
                    className="small-btn"
                    onClick={() => {
                      setForm({ ...initialForm, category: selected.category });
                      setFormStep(0);
                      openSubmit();
                    }}
                  >
                    提交类似发现 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {modal === "submit" && (
            <>
              <p className="eyebrow">TRANSMISSION FORM / 社区投稿</p>
              <h2 id="modal-title">发出你的信号。</h2>
              <p className="form-intro">
                先整理线索，再到 GitHub 确认公开提交。
              </p>
              <div className="form-steps">
                {["记录发现", "补充依据", "预览与发送"].map((x, i) => (
                  <span key={x} className={formStep >= i ? "done" : ""}>
                    <b className="mono">0{i + 1}</b>
                    {x}
                  </span>
                ))}
              </div>
              <form onSubmit={nextForm}>
                {formStep === 0 && (
                  <>
                    <label>
                      哪个产品或智能体？
                      <input
                        required
                        maxLength={100}
                        value={form.product}
                        onChange={(e) =>
                          setForm({ ...form, product: e.target.value })
                        }
                        placeholder="产品、版本，或填“不确定”"
                      />
                    </label>
                    <label>
                      一句话描述发现
                      <input
                        required
                        minLength={4}
                        maxLength={100}
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="原本应该做什么，实际发生了什么？"
                      />
                    </label>
                    <label>
                      风险类型
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value })
                        }
                      >
                        {["暂不确定", ...channels.slice(1)].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <div className="draft-buttons">
                      <button type="button" onClick={restoreDraft}>
                        恢复本机草稿
                      </button>
                      <button type="button" onClick={clearDraft}>
                        清除本机草稿
                      </button>
                    </div>
                    <button className="btn ink full" type="submit">
                      下一步：补充依据 <ArrowRight size={17} />
                    </button>
                  </>
                )}
                {formStep === 1 && (
                  <>
                    <label>
                      简单讲讲经过
                      <textarea
                        required
                        minLength={15}
                        maxLength={2000}
                        rows={4}
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="预期行为、实际行为、环境与影响，至少 15 字。"
                      />
                    </label>
                    <label>
                      公开来源或脱敏证据
                      <textarea
                        required
                        minLength={5}
                        maxLength={1500}
                        rows={3}
                        value={form.evidence}
                        onChange={(e) =>
                          setForm({ ...form, evidence: e.target.value })
                        }
                        placeholder="公开链接、脱敏日志片段或证据说明。不要填写密码、密钥、个人隐私。"
                      />
                    </label>
                    <div className="form-navigation">
                      <button
                        type="button"
                        className="small-btn"
                        onClick={() => setFormStep(0)}
                      >
                        <ChevronLeft size={16} />
                        上一步
                      </button>
                      <button className="btn ink" type="submit">
                        预览信号 <ArrowRight size={17} />
                      </button>
                    </div>
                  </>
                )}
                {formStep === 2 && (
                  <>
                    <div className="submission-preview">
                      <p className="eyebrow">REPORT DRAFT / 尚未提交</p>
                      <h3>{form.title}</h3>
                      <p className="preview-meta">
                        {form.product} / {form.category}
                      </p>
                      <h4>事件经过</h4>
                      <p>{form.description}</p>
                      <h4>依据</h4>
                      <p>{form.evidence}</p>
                    </div>
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>
                        我已移除敏感信息，并了解 GitHub Issue 将公开可见。
                      </span>
                    </label>
                    {issueUrl ? (
                      <a
                        className={`btn orange full ${!consent ? "disabled-link" : ""}`}
                        href={consent ? issueUrl : undefined}
                        aria-disabled={!consent}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (!consent) e.preventDefault();
                        }}
                      >
                        到 GitHub 确认提交 <ArrowUpRight size={17} />
                      </a>
                    ) : (
                      <p className="form-help">
                        内容较长，请下载完整草稿，再到仓库新建 Issue
                        并附上公开材料。
                      </p>
                    )}
                    <p className="form-help">
                      只有在 GitHub 点击 “Submit new issue”
                      后才算提交成功。私密线索请仅下载草稿，通过合适的私密渠道披露。
                    </p>
                    <div className="form-navigation">
                      <button
                        type="button"
                        className="small-btn"
                        onClick={() => setFormStep(1)}
                      >
                        <ChevronLeft size={16} />
                        修改
                      </button>
                      <button
                        type="button"
                        className="small-btn"
                        onClick={saveDraft}
                      >
                        保存到本机
                      </button>
                      <button
                        type="button"
                        className="small-btn"
                        onClick={download}
                      >
                        <Download size={15} />
                        下载 JSON
                      </button>
                    </div>
                  </>
                )}
              </form>
              {notice && (
                <p className="notice" role="status">
                  {notice}
                </p>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
