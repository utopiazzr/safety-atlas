export const INTAKE_API =
  "https://safety-atlas-intake.aurora-scarf-6347.chatgpt.site";
export const uploadLimits = {
  file: 512 * 1024 * 1024,
  total: 1024 * 1024 * 1024,
  count: 100,
  part: 8 * 1024 * 1024,
};
export function allowedProjectPath(value) {
  const path = value.replaceAll("\\", "/"),
    parts = path.split("/");
  return (
    path.length > 0 &&
    path.length <= 300 &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    !path.startsWith("/") &&
    !/^[a-z]:/i.test(path) &&
    !parts.some(
      (p) =>
        !p ||
        p === "." ||
        p === ".." ||
        /^(node_modules|\.git|\.svn|\.ssh|\.aws|\.venv|venv|__pycache__|dist|build)$/i.test(
          p,
        ) ||
        (/^\.env(?:\.|$)/i.test(p) && !/^\.env\.(example|sample)$/i.test(p)) ||
        /\.(pem|key|p12|pfx|exe|dll|msi|bat|cmd|com|scr)$/i.test(p) ||
        /^(id_rsa|id_ed25519|credentials)$/i.test(p),
    )
  );
}
export function inspectFiles(incoming, existing = []) {
  const accepted = [],
    rejected = [];
  let total = existing.reduce((n, f) => n + f.size, 0);
  const names = new Set(existing.map((f) => f.path.toLowerCase()));
  for (const file of incoming) {
    const path = file.webkitRelativePath || file.name;
    if (
      !allowedProjectPath(path) ||
      file.size < 1 ||
      file.size > uploadLimits.file ||
      total + file.size > uploadLimits.total ||
      existing.length + accepted.length >= uploadLimits.count ||
      names.has(path.toLowerCase())
    ) {
      rejected.push(path);
      continue;
    }
    accepted.push({ path, size: file.size, type: file.type, file });
    names.add(path.toLowerCase());
    total += file.size;
  }
  return { accepted, rejected };
}
export function newReceipt() {
  return {
    version: 1,
    id: crypto.randomUUID(),
    key: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    api: INTAKE_API,
  };
}
export function parseReceipt(value) {
  if (
    value?.version !== 1 ||
    value.api !== INTAKE_API ||
    typeof value.id !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.id,
    ) ||
    typeof value.key !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.key)
  )
    throw Error("回执文件无效 / Invalid receipt");
  return { version: 1, id: value.id, key: value.key, api: INTAKE_API };
}
/** @param {string} path @param {{method?:string,body?:any,receipt?:any,signal?:AbortSignal}} [options] */
export async function cloudRequest(
  path,
  { method = "GET", body, receipt, signal } = {},
) {
  if (!path.startsWith("/api/") || path.includes(".."))
    throw Error("Invalid API path");
  const binary = body instanceof Uint8Array;
  const r = await fetch(INTAKE_API + path, {
    method,
    redirect: "error",
    headers: {
      ...(body === undefined
        ? {}
        : {
            "Content-Type": binary
              ? "application/octet-stream"
              : "application/json",
          }),
      ...(receipt ? { Authorization: `Bearer ${receipt.key}` } : {}),
    },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    signal,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("云端服务暂时不可用 / Intake service unavailable");
  }
  if (!r.ok)
    throw Object.assign(Error(data.error || `Request failed (${r.status})`), {
      status: r.status,
    });
  return data;
}
export async function uploadProject(receipt, materials, onProgress, signal) {
  const prefix = `/api/submissions/${receipt.id}`,
    status = await cloudRequest(prefix, { receipt, signal });
  if (status.status !== "uploading") return status;
  const total = status.files.reduce((n, f) => n + f.size, 0);
  let completed = 0;
  for (const descriptor of status.files) {
    const item = materials.find(
      (m) => m.path === descriptor.path && m.size === descriptor.size,
    );
    if (!item) throw Error(`请重新选择文件 / Reselect: ${descriptor.path}`);
    const count = Math.ceil(item.size / uploadLimits.part);
    for (let part = 0; part < count; part++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const bytes = new Uint8Array(
        await item.file
          .slice(
            part * uploadLimits.part,
            Math.min(item.size, (part + 1) * uploadLimits.part),
          )
          .arrayBuffer(),
      );
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const prior = status.parts.find(
        (p) => p.file_id === descriptor.id && p.part_number === part,
      );
      if (prior && prior.digest !== hash)
        throw Error(`文件内容已变化 / File changed: ${descriptor.path}`);
      if (!prior)
        await cloudRequest(`${prefix}/files/${descriptor.id}/parts/${part}`, {
          method: "PUT",
          body: bytes,
          receipt,
          signal,
        });
      completed += bytes.length;
      onProgress({ completed, total, file: descriptor.path });
    }
  }
  return cloudRequest(prefix + "/complete", {
    method: "POST",
    receipt,
    signal,
  });
}
