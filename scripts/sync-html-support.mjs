import * as fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
export function resolveSource(root, env = process.env) {
  return path.resolve(
    env.GODPOWER_HTML_SOURCE ||
      path.join(
        env.GODPOWER_HTML_REPO || path.join(root, "..", "godpower-html"),
        "dist/godpower.html",
      ),
  );
}
export async function prepareSync({ root, source }) {
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
    await fs.readFile(path.join(sourceRoot, "package.json"), "utf8"),
  );
  if (typeof sourcePackage.version !== "string")
    throw Error("HTML source package version is missing");
  const hostPackage = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  const hostLock = JSON.parse(
    await fs.readFile(path.join(root, "package-lock.json"), "utf8"),
  );
  const relative = path.relative(sourceRoot, source).split(path.sep).join("/");
  const committed = execFileSync(
    "git",
    ["-C", sourceRoot, "show", `${sourceCommit}:${relative}`],
    { maxBuffer: 20e6 },
  );
  // Preserve the clean-source and reproducible-build contract, before any host writes.
  execFileSync(process.execPath, ["scripts/build.mjs"], {
    cwd: sourceRoot,
    stdio: "inherit",
  });
  const html = await fs.readFile(source);
  if (!html.equals(committed))
    throw Error(
      "HTML build differs from committed artifact. Commit rebuilt source/artifacts first.",
    );
  const canonicalTooltipCss = "src/styles/components/tooltips.css";
  // Select from the pinned tree, never from an uncommitted file or a failed read.
  const cssSource = execFileSync("git", ["-C", sourceRoot, "ls-tree", "--name-only", sourceCommit, canonicalTooltipCss], {encoding:"utf8"}).trim()
    ? canonicalTooltipCss : "src/ui/tooltips.css";
  const assetSources = { js: "src/ui/tooltips.js", css: cssSource };
  const assets = Object.fromEntries(
    ["js", "css"].map((ext) => [
      ext,
      execFileSync(
        "git",
        ["-C", sourceRoot, "show", `${sourceCommit}:${assetSources[ext]}`],
        { maxBuffer: 2e6 },
      ),
    ]),
  );
  hostPackage.version = sourcePackage.version;
  hostLock.version = sourcePackage.version;
  if (hostLock.packages?.[""])
    hostLock.packages[""].version = sourcePackage.version;
  const info = {
    sourceRepository: "mylittleblover/godpower-html",
    sourceFile: relative,
    sourceCommit,
    htmlSha256: hash(html),
    htmlBytes: html.length,
    presentationAssetSources: Object.fromEntries(Object.entries(assetSources).map(([ext, source]) => [`tooltips.${ext}`, source])),
    presentationAssets: Object.fromEntries(
      Object.entries(assets).map(([ext, content]) => [
        `tooltips.${ext}`,
        hash(content),
      ]),
    ),
  };
  return {
    info,
    files: [
      ["package.json", json(hostPackage)],
      ["package-lock.json", json(hostLock)],
      ["resources/index.html", html],
      ["resources/BUILD_INFO.json", json(info)],
      ...Object.entries(assets).map(([ext, content]) => [
        `renderer/tooltips.${ext}`,
        content,
      ]),
    ],
  };
}
async function readOptional(io, filename) {
  try {
    return await io.readFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
export async function syncHtml({
  root,
  source = resolveSource(root),
  io = fs,
}) {
  root = path.resolve(root);
  source = path.resolve(source);
  const lockPath = path.join(root, ".sync-html.lock");
  let lock;
  try {
    lock = await io.open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw Error(
        "HTML sync already running, or a stale .sync-html.lock needs operator review",
      );
    throw error;
  }
  let stage;
  const replaced = [],
    snapshots = new Map();
  try {
    // All source, build, package and tooltip checks finish before host artifacts change.
    const prepared = await prepareSync({ root, source });
    for (const [relative] of prepared.files) {
      const target = path.join(root, relative);
      snapshots.set(target, await readOptional(io, target));
    }
    stage = await io.mkdtemp(path.join(root, ".sync-html-"));
    for (const [index, [, content]] of prepared.files.entries())
      await io.writeFile(path.join(stage, String(index)), content);
    for (const [index, [relative]] of prepared.files.entries()) {
      const target = path.join(root, relative);
      await io.mkdir(path.dirname(target), { recursive: true });
      await io.rename(path.join(stage, String(index)), target);
      replaced.push(target);
    }
    return prepared.info;
  } catch (error) {
    const failures = [];
    for (const target of replaced.reverse()) {
      try {
        const previous = snapshots.get(target);
        if (previous === null) await io.rm(target, { force: true });
        else await io.writeFile(target, previous);
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        "HTML sync and rollback failed; verify all host artifacts before packaging",
      );
    throw error;
  } finally {
    try {
      if (
        stage &&
        path.dirname(stage) === root &&
        path.basename(stage).startsWith(".sync-html-")
      )
        await io.rm(stage, { recursive: true, force: true });
    } finally {
      await lock.close();
      await io.rm(lockPath, { force: true });
    }
  }
}
