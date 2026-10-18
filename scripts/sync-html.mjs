import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  process.env.GODPOWER_HTML_SOURCE ||
    path.join(repoRoot, "..", "godpower-structure", "dist", "godpower.html"),
);
const targetDir = path.join(repoRoot, "resources");
const target = path.join(targetDir, "index.html");

await mkdir(targetDir, { recursive: true });
const html = await readFile(source);
await copyFile(source, target);

let sourceCommit = null;
try {
  sourceCommit = execFileSync("git", ["-C", path.dirname(source), "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // A detached HTML artifact still works; its content hash remains recorded.
}

const buildInfo = {
  sourceFile: path.basename(source),
  sourceCommit,
  htmlSha256: createHash("sha256").update(html).digest("hex"),
  htmlBytes: html.byteLength,
  syncedAt: new Date().toISOString(),
};
await writeFile(
  path.join(targetDir, "BUILD_INFO.json"),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
);
console.log(`Synced ${source} -> ${target}`);
console.log(JSON.stringify(buildInfo, null, 2));
