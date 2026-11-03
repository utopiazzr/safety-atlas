// Reused from safety-atlas/src/intake.mjs. No network requests.
export function webUrl(value) {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
export function canonicalUrl(value) {
  if (!webUrl(value)) return "";
  const u = new URL(value);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.hostname = u.hostname.toLowerCase();
  return u.href.replace(/\/$/, "");
}
export function resourceType(url) {
  const u = new URL(url),
    host = u.hostname.toLowerCase(),
    path = u.pathname.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/.test(path)) return "image";
  if (host === "github.com" && path.startsWith("/user-attachments/"))
    return "link";
  if (
    /\.(mp4|webm|mov)$/.test(path) ||
    ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com"].includes(host)
  )
    return "video";
  if (host === "huggingface.co")
    return path.startsWith("/datasets/")
      ? "dataset"
      : /\/spaces\//.test(path)
        ? "product"
        : "model";
  if (
    ["github.com", "gitlab.com", "codeberg.org"].includes(host) &&
    !/\/(issues|pull|discussions)\//.test(path)
  )
    return "repository";
  return "link";
}
export function extractLinks(text, { includeCode = false } = {}) {
  const source = includeCode
    ? String(text)
    : String(text).replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const found = source.match(/https?:\/\/[^\s<>"`]+/g) || [];
  return [
    ...new Set(
      found
        .map((value) => {
          let url = value.replace(/[.,;，。；！!]+$/, "");
          while (
            (url.endsWith(")") &&
              (url.match(/\)/g) || []).length >
                (url.match(/\(/g) || []).length) ||
            url.endsWith("]")
          )
            url = url.slice(0, -1);
          return url;
        })
        .filter(webUrl),
    ),
  ];
}
