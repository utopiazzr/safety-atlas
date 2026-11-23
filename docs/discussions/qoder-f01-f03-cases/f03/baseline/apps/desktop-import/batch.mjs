import { Worker } from "node:worker_threads";

export function convertBatch(cells) {
  const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
    workerData: cells,
  });
  return new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Notebook conversion worker exited with ${code}`));
    });
  });
}
