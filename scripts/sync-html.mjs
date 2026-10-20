import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  process.env.GODPOWER_HTML_SOURCE ||
    path.join(
      process.env.GODPOWER_HTML_REPO || path.join(root, "..", "godpower-html"),
      "dist/godpower.html",
    ),
);
const git = (...args) =>
  execFileSync("git", ["-C", path.dirname(source), ...args], {
    encoding: "utf8",
    maxBuffer: 20e6,
  }).trim();
const sourceRoot = git("rev-parse", "--show-toplevel");
const sourceCommit = git("rev-parse", "HEAD");
if (git("status", "--porcelain"))
  throw Error("HTML source checkout must be clean and committed before sync");
const sourcePackage = JSON.parse(
  await readFile(path.join(sourceRoot, "package.json"), "utf8"),
);
if (typeof sourcePackage.version !== "string")
  throw Error("HTML source package version is missing");
const hostPackagePath = path.join(root, "package.json");
const hostLockPath = path.join(root, "package-lock.json");
const hostPackage = JSON.parse(await readFile(hostPackagePath, "utf8"));
const hostLock = JSON.parse(await readFile(hostLockPath, "utf8"));
hostPackage.version = sourcePackage.version;
hostLock.version = sourcePackage.version;
if (hostLock.packages?.[""]) hostLock.packages[""].version = sourcePackage.version;
await writeFile(hostPackagePath, JSON.stringify(hostPackage, null, 2) + "\n");
await writeFile(hostLockPath, JSON.stringify(hostLock, null, 2) + "\n");
const relative = path.relative(sourceRoot, source).split(path.sep).join("/");
const committed = execFileSync(
  "git",
  ["-C", sourceRoot, "show", `${sourceCommit}:${relative}`],
  { maxBuffer: 20e6 },
);
execFileSync(process.execPath, ["scripts/build.mjs"], {
  cwd: sourceRoot,
  stdio: "inherit",
});
const html = await readFile(source);
if (!html.equals(committed))
  throw Error(
    "HTML build differs from committed artifact. Commit rebuilt source/artifacts first.",
  );
const tooltipAssets=Object.fromEntries(['js','css'].map(ext=>{
  const content=execFileSync('git',['-C',sourceRoot,'show',`${sourceCommit}:src/ui/tooltips.${ext}`],{maxBuffer:2e6});
  return [ext,content];
}));
const info = {
  sourceRepository: "mylittleblover/godpower-html",
  sourceFile: relative,
  sourceCommit,
  htmlSha256: createHash("sha256").update(html).digest("hex"),
  htmlBytes: html.length,
  presentationAssets:Object.fromEntries(Object.entries(tooltipAssets).map(([ext,content])=>[`tooltips.${ext}`,createHash('sha256').update(content).digest('hex')])) ,
};
await mkdir(path.join(root, "resources"), { recursive: true });
await writeFile(path.join(root, "resources/index.html"), html);
await writeFile(
  path.join(root, "resources/BUILD_INFO.json"),
  JSON.stringify(info, null, 2) + "\n",
);
for(const [ext,content] of Object.entries(tooltipAssets)) await writeFile(path.join(root,`renderer/tooltips.${ext}`),content);
console.log(JSON.stringify(info, null, 2));
