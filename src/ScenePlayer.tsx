import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { localize, t, useLocale } from "./i18n";
import type { Scene } from "./scenes";
import { PosterArt } from "./CosmicArt";

const DURATION = 3600;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
type ObjectKind =
  "page" | "agent" | "memory" | "network" | "tool" | "lens" | "report" | "gate";
const cast: Record<string, ObjectKind[]> = {
  echoleak: ["page", "agent", "memory", "network"],
  spaiware: ["page", "agent", "memory", "agent", "network"],
  "whatsapp-mcp": ["tool", "agent", "tool", "network"],
  gcg: ["page", "agent", "lens", "page"],
  pair: ["agent", "agent", "lens", "page"],
  "ecosystem-garak": ["network", "tool", "page", "report"],
  "ecosystem-nemo": ["page", "memory", "tool", "gate"],
  "prompt-guard-2": ["page", "lens", "report", "gate"],
  "mcp-scan": ["tool", "page", "network", "lens"],
};

function Machine({
  kind,
  charge = 0,
  mirror = false,
}: {
  kind: ObjectKind;
  charge?: number;
  mirror?: boolean;
}) {
  const cropId = useId().replace(/:/g, "");
  const index: Record<ObjectKind, number> = {
    agent: 0,
    page: 1,
    memory: 2,
    network: 3,
    tool: 4,
    lens: 5,
    report: 6,
    gate: 7,
  };
  const cell = index[kind];
  return (
    <g
      className="theatre-machine"
      transform={mirror ? "scale(-1 1)" : undefined}
    >
      <ellipse cx="0" cy="139" rx="99" ry="9" fill="#242722" opacity=".08" />
      <defs>
        <clipPath id={cropId}>
          <rect
            x={kind === "tool" ? -124 : -150}
            y="-150"
            width={kind === "tool" ? 274 : 300}
            height="300"
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cropId})`}>
        <svg
          x="-150"
          y="-150"
          width="300"
          height="300"
          viewBox={`${(cell % 3) * 300} ${Math.floor(cell / 3) * 300} 300 300`}
          overflow="hidden"
        >
          <image
            href={`${import.meta.env.BASE_URL}theatre-print.webp`}
            width="900"
            height="900"
          />
        </svg>
      </g>
      {kind === "memory" && (
        <g opacity={charge}>
          <ellipse
            cx="0"
            cy="4"
            rx="148"
            ry="59"
            transform="rotate(-18)"
            fill="none"
            stroke="#c84830"
            strokeWidth="2"
          />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${75 - i * 22} ${-82 + i * 58})`}>
              <path d="M0-6 6 0 0 6-6 0z" fill="#c84830" />
              <circle r="12" fill="none" stroke="#c84830" opacity=".5" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function Theatre({
  caseId,
  scene,
  step,
  progress,
  motion,
  playing,
}: {
  caseId: string;
  scene: Scene;
  step: number;
  progress: number;
  motion: boolean;
  playing: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const event = scene.steps[step];
  const roles = cast[caseId] || scene.nodes.map(() => "page" as ObjectKind);
  const p = motion ? progress : 1;
  const ease = p * p * (3 - 2 * p);
  const arrived = clamp((p - 0.55) / 0.4);
  const isLoop = event.to < event.from;
  const check = event.signal === "check",
    risk = event.signal === "risk";
  const mode = isLoop ? "loop" : check ? "scan" : risk ? "breach" : "transmit";
  const tint = risk ? "#ed8966" : check ? "#b5d5e7" : "#e7c993";
  const curve = isLoop
    ? "M230 196C275 38 625 38 670 196"
    : "M230 196C365 135 535 257 670 196";
  const point = (q: number) => {
    const a = 1 - q;
    return {
      x:
        a * a * a * 230 +
        3 * a * a * q * (isLoop ? 275 : 365) +
        3 * a * q * q * (isLoop ? 625 : 535) +
        q * q * q * 670,
      y:
        a * a * a * 196 +
        3 * a * a * q * (isLoop ? 38 : 135) +
        3 * a * q * q * (isLoop ? 38 : 257) +
        q * q * q * 196,
    };
  };
  const packet = point(ease);
  return localize(
    <div
      className={`signal-theatre ${mode} ${playing ? "running" : ""} ${motion ? "" : "no-motion"}`}
      data-step={step}
      data-progress={progress.toFixed(3)}
      data-mode={mode}
    >
      <div className="theatre-topline">
        <span>MECHANISM / {String(step + 1).padStart(2, "0")}</span>
        <span>机制示意 · 非实测</span>
      </div>
      <svg
        className="theatre-stage"
        viewBox="0 0 900 360"
        role="img"
        aria-label={event.title}
      >
        <defs>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f9efdb" />
            <stop offset=".27" stopColor="#9faec2" />
            <stop offset=".49" stopColor="#f4ecda" />
            <stop offset=".5" stopColor="#263642" />
            <stop offset=".79" stopColor="#bccbd5" />
            <stop offset="1" stopColor="#fff2d3" />
          </linearGradient>
          <radialGradient id={`${uid}-space`}>
            <stop stopColor="#263b4a" />
            <stop offset="1" stopColor="#101c27" />
          </radialGradient>
          <clipPath id={`${uid}-scan`}>
            <rect x="550" y="63" width="250" height="264" />
          </clipPath>
        </defs>
        <rect width="900" height="360" fill={`url(#${uid}-space)`} />
        <g fill="none" stroke="#d4c19b" opacity=".18">
          <ellipse cx="450" cy="202" rx="380" ry="139" />
          <ellipse cx="450" cy="202" rx="385" ry="143" />
          <path d="M0 346Q450 255 900 346M0 352Q450 261 900 352" />
          <path d="M450 18v24m0 282v24M49 202h24m754 0h24" />
          {Array.from({ length: 24 }, (_, i) => (
            <path
              key={i}
              d="M450 59v5"
              transform={`rotate(${i * 15} 450 202)`}
            />
          ))}
        </g>
        <g fill="#e0d5bc" opacity=".6">
          {[
            [66, 90],
            [342, 40],
            [830, 72],
            [370, 308],
            [87, 278],
            [560, 50],
            [818, 290],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1} />
          ))}
        </g>
        <path
          d={curve}
          fill="none"
          stroke="#b8c4c9"
          strokeDasharray="3 9"
          opacity=".35"
        />
        <path
          d={curve}
          pathLength="1"
          fill="none"
          stroke={tint}
          strokeWidth="2.5"
          strokeDasharray={`${Math.max(0.001, ease)} 1`}
        />
        {isLoop && (
          <path
            d="M670 196C625 337 275 337 230 196"
            pathLength="1"
            fill="none"
            stroke={tint}
            strokeWidth="1.5"
            strokeDasharray={`${arrived} 1`}
            opacity=".8"
          />
        )}
        <g transform="translate(202 203) scale(.88)">
          <g className="scene-actor" key={`a-${event.from}`}>
            <Machine
              kind={roles[event.from]}
              mirror={roles[event.from] === "agent"}
              charge={
                roles[event.from] === "memory" &&
                scene.steps
                  .slice(0, step)
                  .some((s) => s.to === event.from && s.signal === "risk")
                  ? 1
                  : 0
              }
            />
          </g>
        </g>
        <g transform="translate(680 203) scale(.88)">
          <g className="scene-actor" key={`b-${event.to}`}>
            <Machine kind={roles[event.to]} charge={risk ? arrived : 0} />
          </g>
        </g>
        <g transform="translate(450 197)" fill="none">
          <ellipse
            rx="31"
            ry="84"
            stroke={`url(#${uid}-metal)`}
            strokeWidth="5"
          />
          <ellipse
            rx="37"
            ry="91"
            stroke="#c9b88f"
            strokeWidth=".7"
            opacity=".6"
          />
          {risk && (
            <path
              d={`M0 -74v${148 * (1 - arrived)}`}
              stroke="#ed8966"
              strokeWidth="2"
              strokeDasharray="4 6"
            />
          )}
        </g>
        {check && (
          <g clipPath={`url(#${uid}-scan)`}>
            <rect
              x="551"
              y={68 + p * 250}
              width="248"
              height="14"
              fill="#b5d5e7"
              opacity=".16"
            />
            <path
              d={`M551 ${68 + p * 250}h248`}
              stroke={tint}
              strokeWidth="2"
            />
          </g>
        )}
        {[0.06, 0.13, 0.2].map((lag, i) => {
          const pos = point(clamp(ease - lag));
          return (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={4 - i}
              fill={tint}
              opacity={p > 0 && p < 0.98 ? 0.5 - i * 0.12 : 0}
            />
          );
        })}
        <g
          transform={`translate(${packet.x} ${packet.y})`}
          opacity={p < 0.98 ? 1 : 0}
        >
          <path d="M0-12 8 0 0 12-8 0z" fill={tint} />
          <circle r="18" fill="none" stroke={tint} opacity=".35" />
        </g>
        {risk && (
          <g opacity={arrived} fill="none" stroke="#ed8966">
            <circle cx="680" cy="203" r="132" strokeDasharray="5 8" />
            <path d="M786 99l13-13m0 28 18-7" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="theatre-roles">
        <span>{scene.nodes[event.from]}</span>
        <b aria-hidden="true">→</b>
        <span>{scene.nodes[event.to]}</span>
      </div>
    </div>,
  );
}

export default function ScenePlayer({
  caseId,
  scene,
  motion,
}: {
  caseId: string;
  scene: Scene;
  motion: boolean;
}) {
  useLocale();
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const clock = useRef(0),
    total = scene.steps.length * DURATION;
  const step = Math.min(scene.steps.length - 1, Math.floor(time / DURATION));
  const progress = time >= total ? 1 : (time % DURATION) / DURATION;
  const finished = time >= total;
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      // RAF timestamps refer to the frame start and may precede this effect.
      clock.current = Math.min(
        total,
        clock.current + Math.max(0, now - previous),
      );
      previous = now;
      setTime(clock.current);
      if (clock.current >= total) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  function seek(value: number) {
    setPlaying(false);
    clock.current = Math.max(0, Math.min(total, value));
    setTime(clock.current);
  }
  function play() {
    if (finished) {
      clock.current = 0;
      setTime(0);
    }
    setPlaying(!playing);
  }
  const event = scene.steps[step];
  return localize(
    <div className="scene-player">
      <figure className="scene-illustration">
        <PosterArt id={caseId} />
        <figcaption>艺术演绎 · 非事件影像</figcaption>
      </figure>
      <div className="scene-console">
        <Theatre
          caseId={caseId}
          scene={scene}
          step={step}
          progress={progress}
          motion={motion}
          playing={playing}
        />
        <div className="theatre-controls">
          <button
            className="theatre-play"
            onClick={play}
            aria-label={
              playing ? "暂停演示" : finished ? "重新播放" : "播放演示"
            }
          >
            {playing ? (
              <Pause size={20} />
            ) : finished ? (
              <RotateCcw size={20} />
            ) : (
              <Play size={20} />
            )}
          </button>
          <label className="theatre-scrubber">
            <span className="sr-only">拖动时间轴</span>
            <input
              type="range"
              min="0"
              max={total}
              step="10"
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="拖动时间轴"
              aria-valuetext={`${step + 1} / ${scene.steps.length}: ${t(event.title)}`}
              style={{ backgroundSize: `${(time / total) * 100}% 100%` }}
            />
          </label>
          <span className="theatre-counter">
            {String(step + 1).padStart(2, "0")} /{" "}
            {String(scene.steps.length).padStart(2, "0")}
          </span>
          <button
            className="icon-btn"
            aria-label="上一步"
            disabled={step === 0}
            onClick={() => seek((step - 1) * DURATION)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label="下一步"
            disabled={step === scene.steps.length - 1}
            onClick={() => seek((step + 1) * DURATION)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="theatre-chapters">
          {scene.steps.map((s, i) => (
            <button
              key={i}
              className={i === step ? "active" : ""}
              aria-pressed={i === step}
              aria-label={`第${i + 1}步：${s.title}`}
              onClick={() => seek(i * DURATION)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <i />
            </button>
          ))}
        </div>
        <div className="stage-caption" aria-live="polite">
          <span>{String(step + 1).padStart(2, "0")}</span>
          <div>
            <h3>{event.title}</h3>
            <p>{event.body}</p>
          </div>
        </div>
      </div>
    </div>,
  );
}
