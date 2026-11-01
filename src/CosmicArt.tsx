import type { CSSProperties } from "react";
const ids = [
  "echoleak",
  "spaiware",
  "whatsapp-mcp",
  "gcg",
  "pair",
  "ecosystem-garak",
  "ecosystem-nemo",
  "prompt-guard-2",
  "mcp-scan",
];
// One compressed atlas. Interactive telemetry is rendered as code, not video.
export function PosterArt({ id }: { id: string; kind?: string }) {
  const index = Math.max(0, ids.indexOf(id));
  const loop = id === "spaiware" || id === "pair";
  const scan =
    id.includes("scan") || id.includes("garak") || id === "prompt-guard-2";
  return (
    <div
      className={`cosmic-cover mechanism-${id}`}
      aria-hidden="true"
      style={
        {
          "--art-x": `${(index % 3) * 50}%`,
          "--art-y": `${Math.floor(index / 3) * 50}%`,
        } as CSSProperties
      }
    >
      <div
        className="cosmic-illustration"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}cosmonaut-atlas.webp)`,
        }}
      />
      <div className="cover-halftone" />
      <svg className="cover-telemetry" viewBox="0 0 400 400">
        <path
          className="cover-corners"
          d="M24 62V24h38m276 0h38v38M24 338v38h38m276 0h38v-38"
        />
        {loop ? (
          <>
            <ellipse
              className="telemetry-orbit"
              cx="200"
              cy="200"
              rx="147"
              ry="105"
            />
            <circle className="telemetry-memory" cx="200" cy="95" r="4" />
          </>
        ) : scan ? (
          <>
            <path className="telemetry-scan" d="M40 200h320" />
            <circle className="telemetry-orbit" cx="200" cy="200" r="140" />
          </>
        ) : (
          <>
            <path className="telemetry-route" d="M65 290Q190 70 335 110" />
            <circle className="telemetry-packet" r="4" />
          </>
        )}
      </svg>
    </div>
  );
}
