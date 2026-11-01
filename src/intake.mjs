export const intents = {
  new: "新线索",
  evidence: "补充证据",
  correction: "更正信息",
};
export const provenance = {
  unsure: "尚不确定",
  observed: "亲身观察",
  reported: "转述公开资料",
  research: "研究或实验",
};
export const kindLabels = {
  suspicion: "怀疑线索",
  incident: "经历的事件",
  report: "外部报道",
  attack: "攻击方法",
  defense: "防御方案",
  resource: "模型与产品",
};
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
export function intakeMetadata(body) {
  const match = String(body).match(
    /<!-- safety-atlas:intake\s+([\s\S]*?)\s*-->/,
  );
  if (!match) return {};
  try {
    const value = JSON.parse(match[1]);
    return {
      ...(Object.hasOwn(kindLabels, value.kind) ? { kind: value.kind } : {}),
      ...(Object.hasOwn(intents, value.intent) ? { intent: value.intent } : {}),
      ...(Object.hasOwn(provenance, value.provenance)
        ? { provenance: value.provenance }
        : {}),
      ...(typeof value.relatedId === "string" &&
      /^[a-z0-9-]{1,100}$/.test(value.relatedId)
        ? { relatedId: value.relatedId }
        : {}),
    };
  } catch {
    return {};
  }
}
export function formField(body, label) {
  const blocks = String(body).split(/^### /m).slice(1);
  const block = blocks.find((x) => x.split("\n")[0].trim() === label);
  const value = block?.slice(block.indexOf("\n") + 1).trim();
  return !value || value === "_No response_" ? "" : value;
}
export function readIntake(body, title = "") {
  const metadata = intakeMetadata(body);
  const kind =
    metadata.kind ||
    Object.entries(kindLabels).find(
      ([, label]) =>
        title.startsWith(`[${label}]`) ||
        body.startsWith(`## ${label}`) ||
        formField(body, "信号类型 / Signal type").startsWith(label) ||
        formField(body, "信号类型") === label,
    )?.[0] ||
    "suspicion";
  const related =
    metadata.relatedId || formField(body, "关联档案 ID（可选）/ Related entry");
  return {
    kind,
    intent:
      metadata.intent ||
      Object.entries(intents).find(([, v]) =>
        formField(body, "投稿目的 / Purpose").startsWith(v),
      )?.[0] ||
      "new",
    provenance:
      metadata.provenance ||
      Object.entries(provenance).find(([, v]) =>
        formField(body, "你如何得知 / How you know").startsWith(v),
      )?.[0] ||
      "unsure",
    relatedId: /^[a-z0-9-]{1,100}$/.test(related) ? related : "",
  };
}
