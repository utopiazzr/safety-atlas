import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Plus,
  ArrowDown,
  ArrowUpRight,
  Play,
  Pause,
  X,
} from "lucide-react";
import { localize, useLocale, LocaleSelect } from "./i18n";
import SignalComposer from "./SignalComposer";
import SignalLibrary from "./SignalLibrary";
export default function App() {
  useLocale();
  const repository =
    import.meta.env.VITE_GITHUB_REPOSITORY || "utopiazzr/safety-atlas";
  const [motion, setMotion] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [submitting, setSubmitting] = useState(false),
    [composerRequest, setComposerRequest] = useState({
      kind: "suspicion",
      seq: 0,
    }),
    [featured, setFeatured] = useState({ id: "", seq: 0 });
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  function contribute(kind = "suspicion") {
    previousFocus.current = document.activeElement as HTMLElement;
    setComposerRequest((r) => ({ kind, seq: r.seq + 1 }));
    setSubmitting(true);
  }
  useEffect(() => {
    if (submitting) {
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
      previousFocus.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [submitting]);
  return localize(
    <div className={`site ${motion ? "" : "still"}`}>
      <header className="masthead">
        <a className="brand" href="./">
          <span className="brand-icon">
            <Radio size={24} />
          </span>
          <span>
            越界档案<small>SAFETY ATLAS</small>
          </span>
        </a>
        <a className="simple-nav" href="#signals">
          探索信号
        </a>
        <LocaleSelect />
        <button className="btn ink" onClick={() => contribute()}>
          <Plus size={18} />
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
              <span>安全信号观测站</span>
              <span className="star">✳</span>
            </div>
            <h1>
              未来已来。
              <br />
              <span>边界未定。</span>
            </h1>
            <p>人类掌舵。发现威胁，共建防线。</p>
            <div className="hero-buttons">
              <a href="#signals" className="btn cream">
                探索信号 <ArrowDown size={18} />
              </a>
              <button
                onClick={() =>
                  setFeatured((r) => ({ id: "spaiware", seq: r.seq + 1 }))
                }
                className="outline-btn"
              >
                播放 <Play size={15} />
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
              src={`${import.meta.env.BASE_URL}orbital-observatory.webp`}
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
              }}
              aria-label={motion ? "暂停动态效果" : "开启动效"}
            >
              {motion ? <Pause size={13} /> : <Play size={13} />} MOTION{" "}
              {motion ? "ON" : "OFF"}
            </button>
          </div>
        </section>
        <SignalLibrary
          onContribute={contribute}
          featured={featured}
          motion={motion}
        />
      </main>
      <footer>
        <a className="brand" href="./">
          越界档案
        </a>
        <span>让未来保有人类的选择。</span>
        <a
          href={`https://github.com/${repository}`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight size={14} />
        </a>
      </footer>
      <dialog
        ref={dialog}
        className="submit-dialog"
        aria-labelledby="composer-title"
        onCancel={(e) => {
          e.preventDefault();
          setSubmitting(false);
        }}
        onClick={(e) => {
          if (e.target === dialog.current) setSubmitting(false);
        }}
      >
        <div className="dialog-wrap">
          <button
            className="close"
            onClick={() => setSubmitting(false)}
            aria-label="关闭窗口"
          >
            <X size={22} />
          </button>
          <SignalComposer repository={repository} request={composerRequest} />
        </div>
      </dialog>
    </div>,
  );
}
