import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSource, syncHtml } from "./sync-html-support.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const info = await syncHtml({ root, source: resolveSource(root) });
  console.log(JSON.stringify(info, null, 2));
} catch (error) {
  console.error("HTML sync failed: " + error.message);
  process.exitCode = 1;
}
