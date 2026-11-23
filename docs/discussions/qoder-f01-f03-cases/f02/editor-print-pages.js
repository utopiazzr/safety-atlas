// Save-flow timing: doc(layout) -> string(text) for the four editor pages.
// Mirrors the printer call used while saving a file (printDocToString),
// reporting min-of-N wall time per page so the before/after comparison is stable.
import { performance } from "node:perf_hooks";
import { printer } from "../src/document/public.js";
import { layout, pages } from "../examples/editor/pages.js";

// Options used by the editor save path (normalized with an explicit endOfLine).
const options = { printWidth: 64, tabWidth: 2, useTabs: false, endOfLine: "lf" };
const FRAMES = 12;
const WARMUP = 4;

const report = [];
for (const page of pages) {
  const doc = layout(page);
  for (let i = 0; i < WARMUP; i++) printer.printDocToString(doc, options);
  let min = Number.POSITIVE_INFINITY;
  let last;
  for (let i = 0; i < FRAMES; i++) {
    const start = performance.now();
    last = printer.printDocToString(doc, options);
    min = Math.min(min, performance.now() - start);
  }
  if (!last.formatted.length || last.cursorNodeStart === undefined) {
    throw new Error(`Page ${page.name} is missing text or selection`);
  }
  report.push({ page: page.name, groups: doc.length, ms: Number(min.toFixed(2)) });
}

console.log(JSON.stringify({ action: "save-layout-to-text", frames: FRAMES, report }));
