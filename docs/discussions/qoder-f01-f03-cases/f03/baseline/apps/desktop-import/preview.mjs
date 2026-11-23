import { renderImport } from "../../packages/format-import/index.mjs";

export function previewCell(cell) {
  return renderImport(cell);
}
