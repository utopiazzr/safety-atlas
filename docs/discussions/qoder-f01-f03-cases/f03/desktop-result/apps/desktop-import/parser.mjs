import { createRequire } from "node:module";
import { extname } from "node:path";

// Read through require() so the metadata loads on every supported Node
// release, without relying on JSON import-attribute syntax.
const require = createRequire(import.meta.url);
const languages = require("./languages.json");

// Extension keys in languages.json are stored lowercase; original cell names
// may carry any casing ("Page.TS"), so compare case-insensitively.
const parsersByExtension = new Map(
  Object.entries(languages).map(([extension, parser]) => [extension.toLowerCase(), parser]),
);

export function selectImportParser({ originalName }) {
  if (typeof originalName !== "string") return undefined;
  return parsersByExtension.get(extname(originalName).toLowerCase());
}
