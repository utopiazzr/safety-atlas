import { renderImport } from "../../packages/format-import/index.mjs";
import { selectImportParser } from "./parser.mjs";

export function previewCell(cell) {
  // Project config and EditorConfig in the format service still resolve
  // against the target path; only the language comes from the original name.
  return renderImport({ ...cell, parser: selectImportParser(cell) ?? cell.parser });
}
