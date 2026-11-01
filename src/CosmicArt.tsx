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
// Individually lazy-loaded original illustrations; never used as case evidence.
export function PosterArt({ id, kind }: { id: string; kind?: string }) {
  const index = ids.includes(id)
    ? ids.indexOf(id)
    : kind === "attack"
      ? 4
      : kind === "defense"
        ? 6
        : kind === "resource"
          ? 7
          : 2;
  const loop = id === "spaiware" || id === "pair";
  const scan =
    id.includes("scan") || id.includes("garak") || id === "prompt-guard-2";
  return (
    <div className={`cosmic-cover mechanism-${id}`} aria-hidden="true">
      <img
        className="cosmic-illustration"
        src={`${import.meta.env.BASE_URL}case-art/${ids[index]}.webp`}
        width="418"
        height="418"
        loading="lazy"
        decoding="async"
        alt=""
      />
      <div className="cover-halftone" />
      <svg className="cover-telemetry" viewBox="0 0 400 400">
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
