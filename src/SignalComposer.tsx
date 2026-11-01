import { localize, useLocale } from "./i18n";
import catalogue from "../data/signals.json";
import { intents, provenance } from "./intake.mjs";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Code2,
  ImagePlus,
  Link,
  Radio,
  HelpCircle,
  Zap,
  ShieldCheck,
  Crosshair,
  Newspaper,
  Box,
  X,
  Plus,
  Download,
  Copy,
  Check,
  FileText,
  Paperclip,
} from "lucide-react";
import {
  hasSignal,
  makeIssueUrl,
  makeMarkdown,
  signalTitle,
  handoffUrl,
} from "./submission.mjs";
type Signal = {
  kind: string;
  title: string;
  note: string;
  code: string;
  resourceType: string;
  context: string;
  intent: string;
  provenance: string;
  relatedId: string;
};
type Material = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  content?: string;
};
const initial: Signal = {
  kind: "suspicion",
  title: "",
  note: "",
  code: "",
  resourceType: "mixed",
  context: "",
  intent: "new",
  provenance: "unsure",
  relatedId: "",
};
const choices = [
  { id: "suspicion", label: "有点可疑", Icon: HelpCircle },
  { id: "incident", label: "我遇到了", Icon: Zap },
  { id: "report", label: "外部报道", Icon: Newspaper },
  { id: "attack", label: "攻击方法", Icon: Crosshair },
  { id: "defense", label: "防御方案", Icon: ShieldCheck },
  { id: "resource", label: "模型 / 产品", Icon: Box },
];
export default function SignalComposer({
  repository,
  request,
}: {
  repository: string;
  request: { kind: string; seq: number; relatedId?: string; intent?: string };
}) {
  useLocale();

  const [form, setForm] = useState(initial),
    [files, setFiles] = useState<Material[]>([]),
    [codeOpen, setCodeOpen] = useState(false),
    [ready, setReady] = useState(false),
    [manualReady, setManualReady] = useState(false),
    [opened, setOpened] = useState(false),
    [notice, setNotice] = useState(""),
    [dragging, setDragging] = useState(false),
    [copied, setCopied] = useState(false),
    [reading, setReading] = useState(false);
  const picker = useRef<HTMLInputElement>(null),
    note = useRef<HTMLTextAreaElement>(null),
    liveFiles = useRef<Material[]>([]),
    readingRef = useRef(false);
  useEffect(
    () => () =>
      liveFiles.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)),
    [],
  );
  useEffect(() => {
    setManualReady(false);
    setOpened(false);
    setCopied(false);
  }, [form, files]);
  useEffect(() => {
    if (
      hasSignal(form, liveFiles.current) &&
      form.relatedId !== (request.relatedId || "")
    ) {
      setNotice(
        "已有草稿已保留；请在分类与补充中确认关联档案，或清空后重新开始。",
      );
    } else
      setForm((f) => ({
        ...f,
        kind: request.kind,
        relatedId: request.relatedId || "",
        intent: request.intent || (request.relatedId ? "evidence" : "new"),
      }));
    setReady(false);
  }, [request]);
  const links = (form.note.match(/https?:\/\/[^\s]+/g) || []).length;
  const count =
    Number(Boolean(form.note.trim())) +
    Number(Boolean(form.code.trim())) +
    files.length;
  const media = files.filter((f) => f.content === undefined);
  const issueUrl = makeIssueUrl(repository, form, files);
  const bodyTooLong = makeMarkdown(form, files).length > 65000;
  const payload = () => ({
    schemaVersion: "0.3",
    ...form,
    files: files.map(({ id, url, ...f }) => f),
  });
  function change(key: keyof Signal, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
    setReady(false);
  }
  async function addFiles(incoming: File[]) {
    if (readingRef.current) return;
    readingRef.current = true;
    setReading(true);
    setNotice("");
    const added: Material[] = [];
    const rejected: string[] = [];
    try {
      for (const file of incoming) {
        const isMedia = /^(image|video)\//.test(file.type),
          isText =
            /\.(txt|md|json|log|csv|py|js|jsx|ts|tsx|html|css|sh|yaml|yml|rs|go|java|c|cpp|sql)$/i.test(
              file.name,
            ) || file.type.startsWith("text/");
        if (
          (!isMedia && !isText) ||
          liveFiles.current.length + added.length >= 8 ||
          file.size > 50 * 1024 * 1024 ||
          (isText && file.size > 200 * 1024)
        ) {
          rejected.push(file.name);
          continue;
        }
        const item: Material = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
        };
        if (isMedia) item.url = URL.createObjectURL(file);
        else item.content = await file.text();
        added.push(item);
      }
      liveFiles.current = [...liveFiles.current, ...added];
      setFiles(liveFiles.current);
      setReady(false);
      if (rejected.length)
        setNotice(
          `未加入：${rejected.join("、")}。支持图片、视频（每个 ≤50MB）和代码/文本（≤200KB），最多 8 个文件。`,
        );
    } catch {
      added.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      setNotice("文件读取失败，请重试。");
    } finally {
      readingRef.current = false;
      setReading(false);
    }
  }
  function remove(id: string) {
    const f = liveFiles.current.find((f) => f.id === id);
    if (f?.url) URL.revokeObjectURL(f.url);
    liveFiles.current = liveFiles.current.filter((f) => f.id !== id);
    setFiles(liveFiles.current);
    setReady(false);
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload(), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "safety-atlas-signal.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("已导出文字、代码和文件清单；图片视频原文件不包含在 JSON 中。");
  }
  function save() {
    try {
      localStorage.setItem("atlas-signal-draft", JSON.stringify(form));
      setNotice("文字与代码已保存在本机，文件不保存。");
    } catch {
      setNotice("本机保存不可用，请下载草稿。");
    }
  }
  function restore() {
    try {
      const d = JSON.parse(
        localStorage.getItem("atlas-signal-draft") || "null",
      );
      if (
        !d ||
        !["title", "note", "code", "kind"].every(
          (k) => typeof d[k] === "string",
        ) ||
        !choices.some((c) => c.id === d.kind)
      )
        throw Error();
      setForm({
        ...initial,
        ...Object.fromEntries(
          Object.keys(initial)
            .filter((k) => typeof d[k] === "string")
            .map((k) => [k, d[k]]),
        ),
      });
      setCodeOpen(Boolean(d.code));
      setReady(false);
      setNotice("文字草稿已恢复，文件需重新加入。");
    } catch {
      setNotice("没有可恢复的草稿。");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(makeMarkdown(form, files));
      setCopied(true);
    } catch {
      setNotice("无法复制，请下载完整 Markdown 后粘贴到 GitHub。");
    }
  }
  function downloadMarkdown() {
    const url = URL.createObjectURL(
      new Blob([makeMarkdown(form, files)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "safety-atlas-submission.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setManualReady(true);
  }
  const linkedEntry = catalogue.find((e) => e.id === form.relatedId);
  const validTarget = form.intent === "new" || Boolean(linkedEntry);
  const destination = handoffUrl(repository, form, files);
  return localize(
    <div className="signal-composer simple-composer">
      <div className="composer-heading">
        <span className={count ? "input-light ready" : "input-light"}>
          <Radio size={26} />
        </span>
        <h2 id="composer-title">投一束信号。</h2>
      </div>
      <p className="composer-intro">
        一份材料就能开始。分类、补证和整理可以一起完成。
      </p>
      {linkedEntry && (
        <div className="submission-target">
          <span>关联档案</span>
          <strong>{linkedEntry.title}</strong>
        </div>
      )}
      <div
        className={`signal-drop ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            void addFiles(Array.from(e.clipboardData.files));
          }
        }}
      >
        <textarea
          ref={note}
          aria-label="你的线索"
          maxLength={15000}
          value={form.note}
          onChange={(e) => change("note", e.target.value)}
          placeholder="一句怀疑、一个链接、一段发现…"
          rows={4}
        />
        <div className="drop-toolbar">
          <div>
            <button
              type="button"
              title="添加图片或视频"
              aria-label="添加图片或视频"
              onClick={() => picker.current?.click()}
            >
              <ImagePlus size={20} />
            </button>
            <button
              type="button"
              title="加入代码"
              aria-label="加入代码"
              aria-pressed={codeOpen}
              onClick={() => setCodeOpen(!codeOpen)}
            >
              <Code2 size={20} />
            </button>
            <button
              type="button"
              title="添加代码或文本文件"
              aria-label="添加代码或文本文件"
              onClick={() => picker.current?.click()}
            >
              <Paperclip size={19} />
            </button>
          </div>
          <span>
            {files.length ? files.length + " FILES" : "拖放图片 / 视频"}
          </span>
        </div>
        {dragging && (
          <div className="drop-overlay">
            <Plus size={42} />
            <span>松开，加入信号</span>
          </div>
        )}
      </div>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.txt,.md,.json,.log,.csv,.py,.js,.jsx,.ts,.tsx,.html,.css,.sh,.yaml,.yml,.rs,.go,.java,.c,.cpp,.sql"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {(codeOpen || form.code) && (
        <div className="code-input">
          <label>
            <Code2 size={15} />
            代码 · 仅展示，不执行
          </label>
          <textarea
            aria-label="代码内容"
            spellCheck={false}
            maxLength={30000}
            rows={5}
            placeholder="粘贴代码、复现片段或日志…"
            value={form.code}
            onChange={(e) => change("code", e.target.value)}
          />
        </div>
      )}
      {files.length > 0 && (
        <div className="material-tray">
          {files.map((f) => (
            <div className="material" key={f.id}>
              {f.type.startsWith("image/") ? (
                <img src={f.url} alt={f.name} />
              ) : f.type.startsWith("video/") ? (
                <video
                  src={f.url}
                  controls
                  preload="metadata"
                  onError={() =>
                    setNotice(
                      "该视频编码无法在浏览器预览；原文件仍可在 GitHub 附上。",
                    )
                  }
                />
              ) : (
                <div className="text-material">
                  <FileText size={25} />
                  <pre>{f.content?.slice(0, 120)}</pre>
                </div>
              )}
              <div>
                <span title={f.name}>{f.name}</span>
                <button
                  type="button"
                  aria-label={`移除 ${f.name}`}
                  onClick={() => remove(f.id)}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {media.length > 0 && (
        <p className="attachment-note">
          图片视频尚未上传，请在 GitHub 附上原文件。
        </p>
      )}
      <details className="composer-options">
        <summary>
          分类与补充 <Plus size={15} />
        </summary>
        <div className="submission-purpose" aria-label="投稿目的">
          {Object.entries(intents).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={form.intent === id}
              onClick={() => change("intent", id)}
            >
              {label}
            </button>
          ))}
        </div>
        {form.intent !== "new" && (
          <label className="resource-format">
            关联档案
            <select
              aria-label="关联档案"
              value={form.relatedId}
              onChange={(e) => change("relatedId", e.target.value)}
            >
              <option value="">选择需要补充或更正的档案</option>
              {catalogue.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="resource-format">
          你如何得知
          <select
            aria-label="你如何得知"
            value={form.provenance}
            onChange={(e) => change("provenance", e.target.value)}
          >
            {Object.entries(provenance).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="signal-kinds" aria-label="这是什么信号">
          {choices.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={form.kind === id}
              onClick={() => change("kind", id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <label className="resource-format">
          链接用途（可选）
          <select
            aria-label="材料形式"
            value={form.resourceType}
            onChange={(e) => change("resourceType", e.target.value)}
          >
            <option value="mixed">自动 / 混合</option>
            <option value="model">模型</option>
            <option value="product">产品</option>
            <option value="dataset">数据集</option>
            <option value="api">API / 服务</option>
            <option value="repository">代码仓库</option>
          </select>
        </label>
        <input
          aria-label="信号标题（可选）"
          value={form.title}
          maxLength={100}
          onChange={(e) => change("title", e.target.value)}
          placeholder="标题（可选）"
        />
        <textarea
          aria-label="信号运行条件"
          value={form.context}
          maxLength={4000}
          rows={3}
          placeholder="目标、版本、权限、运行条件或防御局限…"
          onChange={(e) => change("context", e.target.value)}
        />
        <div className="draft-actions">
          <button onClick={save}>保存文字</button>
          <button onClick={restore}>恢复</button>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("atlas-signal-draft");
                liveFiles.current.forEach(
                  (f) => f.url && URL.revokeObjectURL(f.url),
                );
                liveFiles.current = [];
                setFiles([]);
                setForm(initial);
                setReady(false);
                setNotice("已清空当前草稿与本机保存。");
              } catch {
                setNotice("无法访问本机存储。");
              }
            }}
          >
            清除
          </button>
          <button onClick={download}>
            <Download size={14} />
            导出 JSON
          </button>
        </div>
      </details>
      {ready && (
        <div className="submission-handoff">
          <div className="handoff-heading">
            <Check size={20} />
            <h3>检查这份投稿</h3>
            <span>尚未提交</span>
          </div>
          <p>
            {intents[form.intent as keyof typeof intents]} ·{" "}
            {provenance[form.provenance as keyof typeof provenance]}
          </p>
          {linkedEntry && <p>{linkedEntry.title}</p>}
          <details>
            <summary>查看将带到 GitHub 的内容</summary>
            <pre>
              {makeMarkdown(form, files).replace(/^<!--[^]*?-->\n\n/, "")}
            </pre>
          </details>
          {media.length > 0 && (
            <p className="attachment-note">
              下一步仍需在 GitHub 拖入原始图片或视频。
            </p>
          )}
          <p>
            GitHub 登录后检查内容并点击 Create。Issue
            是公开投稿；进入目录还需要审核。
          </p>
        </div>
      )}
      {ready && !issueUrl && hasSignal(form, files) && (
        <div className="long-signal">
          <p>内容较长，请先复制全文，再到 GitHub 粘贴。</p>
          <button onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copied ? "已复制" : "复制全文"}
          </button>
          <button onClick={downloadMarkdown}>
            <Download size={16} />
            下载完整 Markdown
          </button>
        </div>
      )}
      <div className="composer-footer">
        <span className="composer-privacy">到 GitHub 最后确认公开。</span>
        {!ready ? (
          <button
            className="btn orange"
            disabled={
              !hasSignal(form, files) || reading || !validTarget || bodyTooLong
            }
            onClick={() => setReady(true)}
          >
            检查并继续 <ArrowUpRight size={18} />
          </button>
        ) : (
          <>
            <button className="handoff-back" onClick={() => setReady(false)}>
              <ArrowLeft size={16} />
              继续编辑
            </button>
            <a
              role="link"
              className={`btn orange ${!destination || (!issueUrl && !copied && !manualReady) ? "disabled-link" : ""}`}
              href={
                destination && (issueUrl || copied || manualReady)
                  ? destination
                  : undefined
              }
              aria-disabled={
                !destination || (!issueUrl && !copied && !manualReady)
              }
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!destination || (!issueUrl && !copied && !manualReady))
                  e.preventDefault();
                else setOpened(true);
              }}
            >
              前往 GitHub 确认 <ArrowUpRight size={18} />
            </a>
          </>
        )}
      </div>
      {!validTarget && <p className="notice">请在分类与补充中选择关联档案。</p>}
      {bodyTooLong && (
        <p className="notice" role="status">
          内容超过单条投稿容量。请把长文件放到公开仓库或
          Gist，在这里保留摘要与链接；草稿仍可导出。
        </p>
      )}
      {opened && (
        <p className="notice" role="status">
          已打开 GitHub；只有在那里完成提交后，才会生成投稿编号。
          <a
            href={`https://github.com/${repository}/issues?q=is%3Aissue%20author%3A%40me`}
            target="_blank"
            rel="noreferrer"
          >
            查看我的投稿
          </a>
        </p>
      )}
      <p className="submission-private">
        尚未公开的漏洞或含私人数据的材料，请先通过受影响项目的私密渠道披露。
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>,
  );
}
