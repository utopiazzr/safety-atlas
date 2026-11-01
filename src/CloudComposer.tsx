import { createElement, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Code2,
  FolderUp,
  Paperclip,
  Radio,
  Upload,
  Download,
  X,
  Pause,
  Check,
  Link2,
  RotateCcw,
} from "lucide-react";
import "altcha";
import "altcha/i18n/zh-cn";
import "./cloud.css";
import {
  INTAKE_API,
  cloudRequest,
  inspectFiles,
  newReceipt,
  parseReceipt,
  uploadProject,
} from "./cloud-client.mjs";
import catalogue from "../data/signals.json";
import { localize, useLocale, t } from "./i18n";
type Material = {
  path: string;
  size: number;
  type: string;
  file: File;
  preview?: string;
};
type Receipt = { version: number; id: string; key: string; api: string };
const initial = {
  kind: "suspicion",
  intent: "new",
  provenance: "unsure",
  relatedId: "",
  title: "",
  note: "",
  code: "",
  context: "",
  projectUrl: "",
  revision: "",
  focusPath: "",
};
export default function CloudComposer({
  repository,
  request,
}: {
  repository: string;
  request: { kind: string; seq: number; relatedId?: string; intent?: string };
}) {
  const locale = useLocale();
  const [form, setForm] = useState(initial),
    [files, setFiles] = useState<Material[]>([]),
    [project, setProject] = useState(false),
    [codeOpen, setCodeOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [proof, setProof] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [available, setAvailable] = useState<boolean | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [status, setStatus] = useState(""),
    [reason, setReason] = useState(""),
    [progress, setProgress] = useState({ completed: 0, total: 0, file: "" }),
    [supplement, setSupplement] = useState(""),
    [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    receiptPicker = useRef<HTMLInputElement>(null),
    widget = useRef<HTMLElement | null>(null),
    controller = useRef<AbortController | null>(null),
    fileRef = useRef<Material[]>([]),
    receiptRef = useRef<Receipt | null>(null);
  const attempt = useRef<{
    receipt: Receipt;
    body: Record<string, unknown>;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const locked = busy || Boolean(receipt) || pending,
    done = Boolean(receipt) && status !== "" && status !== "uploading";
  const meaningful = Boolean(
      form.note.trim() ||
      form.code.trim() ||
      form.projectUrl.trim() ||
      files.length,
    ),
    targetValid =
      form.intent === "new" || catalogue.some((e) => e.id === form.relatedId);
  useEffect(() => {
    cloudRequest("/api/config")
      .then((c) => setAvailable(c.accepting === true))
      .catch(() => setAvailable(false));
    return () => {
      controller.current?.abort();
      fileRef.current.forEach(
        (f) => f.preview && URL.revokeObjectURL(f.preview),
      );
    };
  }, []);
  useEffect(() => {
    if (
      receiptRef.current ||
      form.note ||
      form.code ||
      fileRef.current.length
    ) {
      if (request.seq > 0)
        setNotice("当前草稿已保留。需要另一份投稿时，请先完成或清空。");
      return;
    }
    setForm((f) => ({
      ...f,
      kind: request.kind,
      relatedId: request.relatedId || "",
      intent: request.intent || "new",
    }));
  }, [request]);
  useEffect(() => {
    const element = widget.current;
    if (!element) return;
    const change = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setProof(detail.state === "verified" ? detail.payload || "" : "");
    };
    element.addEventListener("statechange", change);
    return () => element.removeEventListener("statechange", change);
  }, [available, receipt]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function field(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function add(incoming: File[]) {
    if (busy || done || pending) return;
    const result = inspectFiles(incoming, fileRef.current);
    const added = result.accepted.map((f: Material) => ({
      ...f,
      preview: /^(image|video)\//.test(f.type)
        ? URL.createObjectURL(f.file)
        : undefined,
    }));
    fileRef.current = [...fileRef.current, ...added];
    setFiles(fileRef.current);
    setNotice(
      result.rejected.length
        ? `${locale === "en" ? "Excluded unsafe, duplicate or oversized paths:" : "已排除敏感路径、重复或超限文件："} ${result.rejected.slice(0, 5).join("、")}${result.rejected.length > 5 ? "…" : ""}`
        : "",
    );
  }
  function remove(path: string) {
    const item = fileRef.current.find((f) => f.path === path);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    fileRef.current = fileRef.current.filter((f) => f.path !== path);
    setFiles(fileRef.current);
  }
  function download(value: unknown, name: string) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function track(value: Receipt) {
    const result = await cloudRequest(`/api/submissions/${value.id}`, {
      receipt: value,
    });
    receiptRef.current = value;
    setReceipt(value);
    setStatus(result.status);
    setReason(result.reason || "");
    setNotice("");
    return result;
  }
  async function submit() {
    if (busy) return;
    setNotice("");
    setBusy(true);
    controller.current = new AbortController();
    try {
      let current = receiptRef.current;
      if (!current) {
        current = attempt.current?.receipt || newReceipt();
        const body = attempt.current?.body || {
          ...form,
          id: current.id,
          receiptKey: current.key,
          altcha: proof,
          consent,
          files: files.map(({ path, size, type }) => ({ path, size, type })),
        };
        if (new TextEncoder().encode(JSON.stringify(body)).length > 128 * 1024)
          throw Error(
            "文字较长，请作为文件上传，正文保留摘要 / Upload long text as a file.",
          );
        attempt.current = { receipt: current, body };
        setPending(true);
        await cloudRequest("/api/submissions", {
          method: "POST",
          body,
          signal: controller.current.signal,
        });
        attempt.current = null;
        setPending(false);
        receiptRef.current = current;
        setReceipt(current);
        setStatus("uploading");
      }
      const result = await uploadProject(
        current,
        files,
        setProgress,
        controller.current.signal,
      );
      setStatus(result.status);
      setReason(result.reason || "");
      setNotice("");
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "status" in e &&
        [400, 429].includes(Number(e.status))
      ) {
        attempt.current = null;
        setPending(false);
      }
      setNotice(
        e instanceof DOMException && e.name === "AbortError"
          ? "已暂停。已上传片段会保留，可以继续。"
          : e instanceof Error
            ? e.message
            : "提交失败，请重试。",
      );
      setProof("");
      const element = widget.current as
        (HTMLElement & { reset?: () => void }) | null;
      element?.reset?.();
    } finally {
      setBusy(false);
    }
  }
  async function loadReceipt(file?: File) {
    if (!file) return;
    try {
      if (file.size > 4096) throw Error("回执文件无效 / Invalid receipt");
      await track(parseReceipt(JSON.parse(await file.text())));
      setNotice("回执已恢复。继续上传时，请重新选择同一批文件。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "读取失败");
    }
  }
  function reset() {
    controller.current?.abort();
    fileRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    fileRef.current = [];
    receiptRef.current = null;
    attempt.current = null;
    setPending(false);
    setSupplement("");
    setFiles([]);
    setReceipt(null);
    setStatus("");
    setReason("");
    setForm(initial);
    setProof("");
    setConsent(false);
    setProgress({ completed: 0, total: 0, file: "" });
    setNotice("");
  }
  const related = catalogue.find((e) => e.id === form.relatedId);
  return localize(
    <div className="signal-composer cloud-composer">
      <div className="composer-heading">
        <span className="input-light ready">
          <Radio size={26} />
        </span>
        <h2 id="composer-title">投一束信号。</h2>
        <span className="cloud-badge">站内直投</span>
      </div>
      {!done && (
        <>
          <p className="composer-intro">
            一句观察、一份材料，或一个完整项目。免登录，审核后公开。
          </p>
          <div className="intake-modes">
            <button
              disabled={locked}
              aria-pressed={!project}
              onClick={() => setProject(false)}
            >
              <Radio size={16} />
              线索与材料
            </button>
            <button
              disabled={locked}
              aria-pressed={project}
              onClick={() => setProject(true)}
            >
              <FolderUp size={16} />
              项目与大文件
            </button>
          </div>
          {related && (
            <div className="submission-target">
              <span>关联档案</span>
              <strong>{related.title}</strong>
            </div>
          )}
          {project && (
            <div className="project-link">
              <label>
                <Link2 size={16} />
                项目、模型或发布页链接
                <input
                  aria-label="项目链接"
                  disabled={locked}
                  value={form.projectUrl}
                  onChange={(e) => field("projectUrl", e.target.value)}
                  placeholder="https://github.com/… / Hugging Face / Release"
                />
              </label>
              <div>
                <input
                  aria-label="版本或 commit"
                  disabled={locked}
                  value={form.revision}
                  onChange={(e) => field("revision", e.target.value)}
                  placeholder="版本 / commit（可选）"
                  maxLength={200}
                />
                <input
                  aria-label="重点文件路径"
                  disabled={locked}
                  value={form.focusPath}
                  onChange={(e) => field("focusPath", e.target.value)}
                  placeholder="重点文件路径（可选）"
                  maxLength={300}
                />
              </div>
              <p>链接保留版本与来源；上传只需提供与问题有关的文件。</p>
            </div>
          )}
          <div
            className={`signal-drop ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(Array.from(e.dataTransfer.files));
            }}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                add(Array.from(e.clipboardData.files));
              }
            }}
          >
            <textarea
              aria-label="你的线索"
              disabled={locked}
              maxLength={40000}
              value={form.note}
              onChange={(e) => field("note", e.target.value)}
              placeholder="发生了什么？粘贴链接、观察或复现说明…"
              rows={4}
            />
            <div className="drop-toolbar">
              <div>
                <button
                  disabled={busy || done}
                  title="加入文件"
                  aria-label="加入文件"
                  onClick={() => picker.current?.click()}
                >
                  <Paperclip size={19} />
                </button>
                <button
                  disabled={busy || done}
                  title="选择项目文件夹"
                  aria-label="选择项目文件夹"
                  onClick={() => folder.current?.click()}
                >
                  <FolderUp size={20} />
                </button>
                <button
                  disabled={locked}
                  title="加入代码"
                  aria-label="加入代码"
                  aria-pressed={codeOpen}
                  onClick={() => setCodeOpen(!codeOpen)}
                >
                  <Code2 size={20} />
                </button>
              </div>
              <span>拖放材料到这里</span>
            </div>
          </div>
          <input
            ref={picker}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          {createElement("input", {
            ref: folder,
            type: "file",
            hidden: true,
            multiple: true,
            webkitdirectory: "",
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            },
          })}
          {(codeOpen || form.code) && (
            <div className="code-input">
              <label>代码 · 仅展示，不执行</label>
              <textarea
                aria-label="代码内容"
                disabled={locked}
                spellCheck={false}
                rows={5}
                maxLength={40000}
                value={form.code}
                onChange={(e) => field("code", e.target.value)}
              />
            </div>
          )}
          {files.length > 0 && (
            <div className="cloud-files">
              {files.map((f) => (
                <div key={f.path}>
                  {f.type.startsWith("image/") ? (
                    <img src={f.preview} alt={f.path} />
                  ) : f.type.startsWith("video/") ? (
                    <video src={f.preview} controls preload="metadata" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                  <span title={f.path}>
                    {f.path}
                    <small>{(f.size / 1048576).toFixed(2)} MiB</small>
                  </span>
                  <button
                    disabled={busy || pending}
                    aria-label={`移除 ${f.path}`}
                    onClick={() => remove(f.path)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="upload-limits">
            单文件 ≤512 MiB，总计 ≤1 GiB，最多 100
            个文件。大项目可用压缩包或仓库链接。自动排除依赖、密钥路径与可执行文件。
          </p>
          {!receipt && !pending && (
            <details className="composer-options">
              <summary>分类与补充</summary>
              <div className="submission-purpose">
                {[
                  ["new", "新线索"],
                  ["evidence", "补充证据"],
                  ["correction", "更正信息"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={form.intent === id}
                    onClick={() => field("intent", id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.intent !== "new" && (
                <select
                  aria-label="关联档案"
                  value={form.relatedId}
                  onChange={(e) => field("relatedId", e.target.value)}
                >
                  <option value="">选择关联档案</option>
                  {catalogue.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              )}
              <div className="project-link">
                <select
                  aria-label="信号类型"
                  value={form.kind}
                  onChange={(e) => field("kind", e.target.value)}
                >
                  {[
                    ["suspicion", "有点可疑"],
                    ["incident", "我遇到了"],
                    ["report", "外部报道"],
                    ["attack", "攻击方法"],
                    ["defense", "防御方案"],
                    ["resource", "模型 / 产品"],
                  ].map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="你如何得知"
                  value={form.provenance}
                  onChange={(e) => field("provenance", e.target.value)}
                >
                  {[
                    ["unsure", "尚不确定"],
                    ["observed", "亲身观察"],
                    ["reported", "转述公开资料"],
                    ["research", "研究或实验"],
                  ].map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="信号标题（可选）"
                  placeholder="标题（可选）"
                  value={form.title}
                  maxLength={200}
                  onChange={(e) => field("title", e.target.value)}
                />
                <textarea
                  aria-label="条件与局限"
                  placeholder="版本、权限、模型、预算、配置或局限…"
                  value={form.context}
                  maxLength={8000}
                  onChange={(e) => field("context", e.target.value)}
                />
              </div>
            </details>
          )}
          {!receipt && !pending && (
            <>
              <label className="intake-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  我已移除私人数据与密钥，同意维护者审阅材料并公开审核后的摘要。附件默认不公开。
                </span>
              </label>
              {available === true &&
                createElement("altcha-widget", {
                  ref: widget,
                  challenge: INTAKE_API + "/api/challenge",
                  language: locale === "en" ? "en" : "zh-cn",
                  theme: "dark",
                })}
              {available === null && (
                <p className="notice">正在连接云端接收台…</p>
              )}
              {available === false && (
                <p className="notice">
                  云端暂时不可用，草稿仍可导出；请稍后重试。
                </p>
              )}
            </>
          )}
          {receipt && (
            <div className="upload-progress">
              <progress value={progress.completed} max={progress.total || 1} />
              <span>
                {progress.file || t("准备上传")}{" "}
                {progress.total
                  ? Math.floor((progress.completed / progress.total) * 100) +
                    "%"
                  : ""}
              </span>
              <p>回执是访问本次投稿的凭证，请保存且勿分享。</p>
              <button
                onClick={() => download(receipt, "safety-atlas-receipt.json")}
              >
                <Download size={16} />
                保存回执
              </button>
            </div>
          )}
          <div className="composer-footer">
            {busy ? (
              <button
                className="btn orange"
                onClick={() => controller.current?.abort()}
              >
                <Pause size={17} />
                暂停上传
              </button>
            ) : (
              <button
                className="btn orange"
                disabled={
                  !receipt &&
                  !pending &&
                  (!available ||
                    !meaningful ||
                    !consent ||
                    !proof ||
                    !targetValid)
                }
                onClick={submit}
              >
                <Upload size={17} />
                {receipt
                  ? "继续上传"
                  : pending
                    ? "重试本次投稿"
                    : "提交到观测站"}
              </button>
            )}
          </div>
        </>
      )}
      {done && (
        <div className="cloud-receipt">
          <span className="receipt-mark">
            <Check size={32} />
          </span>
          <h3>
            {(
              {
                submitted: "已接收，等待审核",
                "needs-info": "需要补充材料",
                accepted: "摘要已审核",
                exported: "已进入 GitHub 审核",
                rejected: "暂不收录",
              } as Record<string, string>
            )[status] || "投稿进度"}
          </h3>
          <code>{receipt?.id}</code>
          {reason && <p>{reason}</p>}
          <div className="receipt-route">
            <span className="active">已接收</span>
            <span
              className={
                ["accepted", "exported"].includes(status) ? "active" : ""
              }
            >
              整理与审核
            </span>
            <span>进入目录</span>
          </div>
          <p>
            原始附件仅供维护者审阅，未自动公开。请保存回执，以便查进度、继续补证或恢复上传。
          </p>
          <div className="draft-actions">
            <button
              onClick={() => download(receipt, "safety-atlas-receipt.json")}
            >
              <Download size={16} />
              保存回执
            </button>
            <button
              onClick={() =>
                receipt && track(receipt).catch((e) => setNotice(e.message))
              }
            >
              <RotateCcw size={16} />
              刷新进度
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm(t("请先保存回执。离开此投稿不会撤回云端材料。")))
                  reset();
              }}
            >
              开始新投稿
            </button>
          </div>
          {["submitted", "needs-info"].includes(status) && (
            <details className="composer-options">
              <summary>继续补充</summary>
              <textarea
                aria-label="补充说明"
                rows={3}
                maxLength={8000}
                value={supplement}
                onChange={(e) => setSupplement(e.target.value)}
              />
              <button
                disabled={!supplement.trim() || busy}
                onClick={async () => {
                  if (!receipt) return;
                  setBusy(true);
                  try {
                    await cloudRequest(`/api/submissions/${receipt.id}/note`, {
                      method: "POST",
                      body: { note: supplement },
                      receipt,
                    });
                    setSupplement("");
                    await track(receipt);
                    setNotice("补充说明已送达。");
                  } catch (e) {
                    setNotice(e instanceof Error ? e.message : "提交失败");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                发送补充
              </button>
            </details>
          )}
        </div>
      )}
      {done && ["submitted", "needs-info", "rejected"].includes(status) && (
        <button
          className="withdraw-button"
          disabled={busy}
          onClick={async () => {
            if (
              !receipt ||
              !confirm(t("撤回将删除本次投稿和原始附件，无法恢复。"))
            )
              return;
            setBusy(true);
            try {
              await cloudRequest(`/api/submissions/${receipt.id}`, {
                method: "DELETE",
                receipt,
              });
              reset();
              setNotice("已撤回并删除云端材料。");
            } catch (e) {
              setNotice(e instanceof Error ? e.message : "撤回失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          撤回并删除材料
        </button>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {pending && (
        <p className="notice">
          网络结果待确认。重试会使用同一份投稿凭证，不会创建重复记录。
        </p>
      )}
      <div className="cloud-tools">
        {!receipt && !pending && (
          <button
            disabled={busy}
            onClick={() => {
              if (!meaningful || confirm(t("清空当前草稿？"))) reset();
            }}
          >
            清空草稿
          </button>
        )}
        <button disabled={busy} onClick={() => receiptPicker.current?.click()}>
          导入回执 / 查进度
        </button>
        {!receipt && (
          <button
            onClick={() =>
              download(
                {
                  version: 1,
                  ...form,
                  files: files.map(({ path, size, type }) => ({
                    path,
                    size,
                    type,
                  })),
                },
                "safety-atlas-draft.json",
              )
            }
          >
            导出文字草稿
          </button>
        )}
        <a
          href={`https://github.com/${repository}/issues/new?template=signal.yml`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub 备用入口 <ArrowUpRight size={12} />
        </a>
      </div>
      <input
        ref={receiptPicker}
        type="file"
        hidden
        accept="application/json,.json"
        onChange={(e) => {
          void loadReceipt(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>,
  );
}
