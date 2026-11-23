import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const [before, after] = process.argv.slice(2);
assert.ok(before && after, "Usage: node verify.mjs BEFORE_CHECKOUT AFTER_CHECKOUT");
const base = pathToFileURL(resolve(before) + sep);
const changed = pathToFileURL(resolve(after) + sep);
const options = { printWidth: 64, tabWidth: 2, useTabs: false };
const { layout, pages } = await import(new URL("examples/editor/pages.js", base));
const results = [];
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const median = data => {
  const sorted = [...data].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
const revision = {};
for (const [name, root] of [["before", base], ["after", changed]]) {
  const { printer } = await import(new URL("src/document/public.js", root));
  revision[name] = printer;
}
for (const page of pages) {
  const expected = revision.before.printDocToString(layout(page), options);
  for (const mode of ["fresh", "reused"]) {
    const timings = { before: [], after: [] };
    const mismatches = { before: 0, after: 0 };
    for (let round = 0; round < 8; round++) {
      for (const side of round % 2 ? ["after", "before"] : ["before", "after"]) {
        const stable = layout(page);
        const times = [];
        for (let iter = 0; iter < 9; iter++) {
          const doc = mode === "fresh" ? layout(page) : stable;
          const start = performance.now();
          const value = revision[side].printDocToString(doc, options);
          const ms = performance.now() - start;
          if (hash(value) !== hash(expected)) mismatches[side]++;
          if (iter >= 3) times.push(ms);
        }
        timings[side].push(median(times));
      }
    }
    results.push({ page: page.name, mode, timings, mismatches,
      before: median(timings.before), after: median(timings.after),
      pairsFaster: timings.before.filter((v,i) => timings.after[i] < v).length });
  }
}


const save = [];
for (const page of pages) {
  const printed = revision.before.printDocToString(layout(page), options);
  // Simulate an edit to the source before calling the complete formatting API.
  const input = printed.formatted.replace("count: 2,", "count :  222,");
  assert.notEqual(input, printed.formatted);
  for (const cursorOffset of [input.indexOf("222") + 1, input.lastIndexOf("count:")]) {
    const pair = {};
    for (const [side, root] of [["before", base], ["after", changed]]) {
      const { formatWithCursor } = await import(new URL("src/index.js", root));
      const {formatted, cursorOffset: offset} = await formatWithCursor(input, {...options, parser:"babel",cursorOffset});
      pair[side] = { digest: hash(formatted), offset };
    }
    save.push({ page:page.name, cursorOffset, ...pair, same: hash(pair.before) === hash(pair.after) });
  }
}
console.log(JSON.stringify({ timings: results, save }, null, 2));
