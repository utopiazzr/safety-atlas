import {
  Children,
  cloneElement,
  isValidElement,
  useSyncExternalStore,
  type ReactNode,
  type ReactElement,
} from "react";
import dictionary from "./translations.json";
type Locale = "zh" | "en";
let current: Locale = "zh";
try {
  if (localStorage.getItem("atlas-language") === "en") current = "en";
} catch {}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useLocale() {
  return useSyncExternalStore(subscribe, () => current);
}
export function setLocale(locale: Locale) {
  current = locale;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  try {
    localStorage.setItem("atlas-language", locale);
  } catch {}
  listeners.forEach((fn) => fn());
}
document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
export function t(text: string): string {
  if (current === "zh") return text;
  const key = text.trim(),
    value = (dictionary as Record<string, string>)[key];
  if (value) return text.replace(key, value);
  const patterns: [RegExp, (...args: string[]) => string][] = [
    [
      /^接收信号 (\d+)：(.*)$/,
      (n, label) => `Receive signal ${n}: ${t(label)}`,
    ],
    [/^打开 (.*)$/, (label) => `Open ${t(label)}`],
    [/^第(\d+)步：(.*)$/, (n, label) => `Step ${n}: ${t(label)}`],
    [/^取消收藏：(.*)$/, (label) => `Unsave: ${t(label)}`],
    [/^收藏：(.*)$/, (label) => `Save: ${t(label)}`],
    [/^移除 (.*)$/, (name) => `Remove ${name}`],
    [/^(\d+) 份材料$/, (n) => `${n} materials`],
    [
      /^下一站：在 GitHub 编辑框附上这 (\d+) 个原文件。此处尚未上传。$/,
      (n) =>
        `Next: attach these ${n} original files in GitHub. They have not been uploaded.`,
    ],
  ];
  for (const [pattern, replace] of patterns) {
    const m = key.match(pattern);
    if (m) return text.replace(key, replace(...m.slice(1)));
  }
  return text;
}
// Translate rendered labels only. Form values, identifiers, source URLs and code remain intact.
export function localize(node: ReactNode): ReactNode {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return Children.map(node, localize);
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const key of ["aria-label", "title", "placeholder", "alt"])
    if (typeof element.props[key] === "string")
      props[key] = t(element.props[key] as string);
  if (
    element.type !== "pre" &&
    element.type !== "code" &&
    element.type !== "textarea" &&
    element.props.children !== undefined
  )
    props.children = Children.map(
      element.props.children as ReactNode,
      localize,
    );
  return cloneElement(element, props);
}
export function LocaleSelect() {
  const locale = useLocale();
  return (
    <label className="locale-select">
      <span aria-hidden="true">◎</span>
      <select
        aria-label="语言 / Language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
