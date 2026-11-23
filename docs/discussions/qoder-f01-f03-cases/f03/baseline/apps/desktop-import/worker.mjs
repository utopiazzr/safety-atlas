import { parentPort, workerData } from "node:worker_threads";
import { renderImport } from "../../packages/format-import/index.mjs";

const results = [];
for (const cell of workerData) {
  results.push(await renderImport(cell));
}
parentPort.postMessage(results);
