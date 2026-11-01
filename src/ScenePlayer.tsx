import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { localize, t, useLocale } from "./i18n";
import type { Scene } from "./scenes";

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
            href={`${import.meta.env.BASE_URL}theatre-silver.webp`}
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
  const event = scene.steps[step],
    roles = cast[caseId] || scene.nodes.map(() => "page" as ObjectKind);
  const p = motion ? progress : 1,
    ease = p * p * (3 - 2 * p),
    arrived = clamp((p - 0.55) / 0.4);
  const isLoop = event.to < event.from,
    check = event.signal === "check",
    risk = event.signal === "risk";
  const mode = isLoop ? "loop" : check ? "scan" : risk ? "breach" : "transmit";
  const tint = risk ? "#c84830" : check ? "#426b79" : "#282b26";
  const disc = risk ? "#c84830" : check ? "#587d88" : "#bd9653";
  const curve = isLoop
    ? "M245 204C280 42 620 42 665 204"
    : "M245 204C370 127 540 288 665 204";
  const point = (q: number) => {
    const a = 1 - q;
    return {
      x:
        a * a * a * 245 +
        3 * a * a * q * (isLoop ? 280 : 370) +
        3 * a * q * q * (isLoop ? 620 : 540) +
        q * q * q * 665,
      y:
        a * a * a * 204 +
        3 * a * a * q * (isLoop ? 42 : 127) +
        3 * a * q * q * (isLoop ? 42 : 288) +
        q * q * q * 204,
    };
  };
  const packet = point(ease),
    charge = risk ? arrived : 0;
  return localize(
    <div
      className={`signal-theatre ${mode} ${playing ? "running" : ""} ${motion ? "" : "no-motion"}`}
      data-step={step}
      data-progress={progress.toFixed(3)}
      data-mode={mode}
    >
      <div className="theatre-topline">
        <span>SAFETY ATLAS / {String(step + 1).padStart(2, "0")}</span>
        <span>机制示意 · 非实测</span>
      </div>
      <svg
        className="theatre-stage"
        viewBox="0 0 900 360"
        role="img"
        aria-label={event.title}
      >
        <defs>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2=".9" y2=".8">
            <stop stopColor="#fff9e8" />
            <stop offset=".18" stopColor="#9a9c99" />
            <stop offset=".36" stopColor="#faf6e7" />
            <stop offset=".49" stopColor="#d7d5cd" />
            <stop offset=".5" stopColor="#242926" />
            <stop offset=".62" stopColor="#626966" />
            <stop offset=".81" stopColor="#e3e3d8" />
            <stop offset="1" stopColor="#fff9e7" />
          </linearGradient>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fff9e8" />
            <stop offset=".3" stopColor="#aaa99e" />
            <stop offset=".49" stopColor="#f4eedc" />
            <stop offset=".52" stopColor="#353b35" />
            <stop offset="1" stopColor="#c1c2b8" />
          </linearGradient>
          <radialGradient id={`${uid}-sphere`} cx=".3" cy=".25" r=".75">
            <stop stopColor="#fff9e8" />
            <stop offset=".32" stopColor="#cecec5" />
            <stop offset=".65" stopColor="#747b76" />
            <stop offset=".8" stopColor="#252c28" />
            <stop offset="1" stopColor="#b7bbb3" />
          </radialGradient>
          <pattern
            id={`${uid}-dots`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".65" fill="#252c28" opacity=".18" />
          </pattern>
          <clipPath id={`${uid}-scan`}>
            <rect x="541" y="70" width="278" height="270" />
          </clipPath>
        </defs>
        <rect width="900" height="420" fill="#ede7d9" />
        <path
          d={
            isLoop
              ? "M0 400 900 25v33L90 420H0z"
              : "M0 370 900 27v36L110 420H0z"
          }
          fill="#282b26"
          opacity=".08"
        />
        <circle
          cx="680"
          cy="202"
          r={139 + arrived * 6}
          fill={disc}
          opacity={risk ? 0.86 : 0.68}
        />
        <path
          d="M0 351h900M0 357h900M0 366h900"
          stroke="#34372e"
          opacity=".2"
        />
        <path
          d="M43 82h31m-15-16v32M846 301h24m-12-12v24"
          stroke="#c84830"
          strokeWidth="2"
        />
        <circle cx="386" cy="81" r="25" fill={`url(#${uid}-sphere)`} />
        <path d="M315 79h141" stroke="#393c34" opacity=".4" />
        <g fill="none" stroke="#4d6774" strokeWidth="1" opacity=".22">
          <path d="M0 338Q290 256 520 356M0 347Q290 265 520 365M0 356Q290 274 520 374" />
          <path d="M35 346 173 297m-43 57 94-64m21 64 19-69m95 70-45-67m157 77-110-66" />
          <g transform="translate(455 68)">
            <ellipse rx="53" ry="11" />
            <ellipse rx="13" ry="20" />
            <path d="M-45-4H45M-45 4H45M0-41v82M-34-23v46M34-23v46M-64 0H64" />
            <path d="M-13-10 13 10m-26 0 26-20" />
          </g>
          <path d="M36 120V215m-8-60h16m-20 5h24m-24 31h24m-20 5h16m-12-55 8 64m-8 0 8-64" />
        </g>
        <rect width="900" height="420" fill={`url(#${uid}-dots)`} />
        <path
          d={curve}
          fill="none"
          stroke="#6a6e60"
          strokeWidth="1"
          strokeDasharray="4 8"
          opacity=".5"
        />
        <path
          d={curve}
          pathLength="1"
          fill="none"
          stroke={tint}
          strokeWidth="3"
          strokeDasharray={`${Math.max(0.001, ease)} 1`}
          opacity=".8"
        />
        {isLoop && (
          <path
            d="M665 204C620 345 280 345 245 204"
            pathLength="1"
            fill="none"
            stroke="#c84830"
            strokeWidth="1.5"
            strokeDasharray={`${arrived} 1`}
            opacity=".65"
          />
        )}
        <g transform="translate(202 207)">
          <g className="scene-actor" key={`a-${event.from}`}>
            <Machine
              charge={
                roles[event.from] === "memory" &&
                scene.steps
                  .slice(0, step)
                  .some((s) => s.to === event.from && s.signal === "risk")
                  ? 1
                  : 0
              }
              kind={roles[event.from]}
              mirror={roles[event.from] === "agent"}
            />
          </g>
        </g>
        <g transform={`translate(680 ${207 - arrived * 5})`}>
          <g className="scene-actor" key={`b-${event.to}`}>
            <Machine kind={roles[event.to]} charge={charge} />
          </g>
        </g>
        {check ? (
          <g clipPath={`url(#${uid}-scan)`}>
            <rect
              x="542"
              y={75 + p * 255}
              width="276"
              height="18"
              fill="#fff3d6"
              opacity=".22"
            />
            <path
              d={`M542 ${75 + p * 255}h276`}
              stroke={tint}
              strokeWidth="3"
            />
            <path
              d={`M548 ${75 + p * 255 - 5}v10m264-10v10`}
              stroke="#242722"
              strokeWidth="2"
            />
          </g>
        ) : (
          <g transform="translate(450 205)">
            <ellipse
              rx="29"
              ry="87"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="10"
            />
            <ellipse
              rx="35"
              ry="94"
              fill="none"
              stroke="#3a3f35"
              strokeWidth="1"
            />
            {risk && (
              <path
                d={`M0 -78v${Math.max(0, 156 * (1 - arrived))}`}
                stroke="#c84830"
                strokeWidth="3"
                strokeDasharray="5 5"
              />
            )}
          </g>
        )}
        {[0.08, 0.16, 0.24].map((lag, i) => {
          const q = clamp(ease - lag),
            pos = point(q);
          return (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={4 - i}
              fill={tint}
              opacity={p > 0 && p < 0.96 ? 0.55 - i * 0.13 : 0}
            />
          );
        })}
        <g
          className="scene-packet"
          transform={`translate(${packet.x} ${packet.y}) rotate(${ease * 135})`}
          opacity={p < 0.98 ? 1 : 0}
        >
          <path
            d="M0-16 16 0 0 16-16 0z"
            fill={risk ? "#c84830" : `url(#${uid}-metal)`}
            stroke="#292d26"
            strokeWidth="1.5"
          />
          <path d="M0-16v32M-16 0h32" stroke="#f8edd2" strokeWidth="1" />
        </g>
        {risk && (
          <g opacity={arrived}>
            <path
              d="M792 105l20-15m-7 37 24-3m-26 25 21 8"
              stroke="#c84830"
              strokeWidth="3"
            />
            <circle cx="784" cy="155" r="6" fill="#c84830" />
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
          aria-label={playing ? "暂停演示" : finished ? "重新播放" : "播放演示"}
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
    </div>,
  );
}
