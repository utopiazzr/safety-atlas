import { builders } from "../../src/document/public.js";

export const pages = [
  { name: "short-en", groups: 64, multilingual: false },
  { name: "short-zh", groups: 64, multilingual: true },
  { name: "long-en", groups: 4096, multilingual: false },
  { name: "long-zh", groups: 4096, multilingual: true },
];

export function layout({ groups, multilingual }) {
  const { cursor, group, hardline, indent, line } = builders;
  return Array.from({ length: groups }, (_, index) => [
    group([
      `const value${index} = {`,
      indent([
        line,
        index === 2 ? cursor : "",
        multilingual ? "标题: '编辑器🌙'," : "title: 'editor',",
        index === 2 ? cursor : "",
        line,
        `count: ${index},`,
      ]),
      line,
      "};",
    ]),
    hardline,
  ]);
}
