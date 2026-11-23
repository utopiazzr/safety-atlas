import { parentPort, workerData } from "node:worker_threads";
import { renderImport } from "../../packages/format-import/index.mjs";
import { selectImportParser } from "./parser.mjs";

const results = [];
for (const cell of workerData) {
  results.push(await renderImport({ ...cell, parser: selectImportParser(cell) ?? cell.parser }));
}
parentPort.postMessage(results);
