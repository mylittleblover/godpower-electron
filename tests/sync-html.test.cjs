const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");
const scripts = path.resolve(__dirname, "../scripts");
const targets = [
  "package.json",
  "package-lock.json",
  "resources/index.html",
  "resources/BUILD_INFO.json",
  "renderer/tooltips.js",
  "renderer/tooltips.css",
];

test("fresh Windows-style Git checkout preserves all hashed release bytes", () =>
  fixture({}, ({ cli, host }) => {
    const result = cli();
    assert.equal(result.status, 0, result.stderr);
    const attributes = path.resolve(__dirname, "../.gitattributes");
    if (fs.existsSync(attributes))
      fs.copyFileSync(attributes, path.join(host, ".gitattributes"));
    execFileSync("git", ["init", "-q", host]);
    execFileSync("git", ["-C", host, "-c", "core.autocrlf=false", "add", "."]);
    execFileSync("git", [
      "-C",
      host,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "host fixture",
    ]);
    const hashed = [
      "resources/index.html",
      "renderer/tooltips.js",
      "renderer/tooltips.css",
    ];
    for (const name of hashed) fs.unlinkSync(path.join(host, name));
    execFileSync("git", [
      "-C",
      host,
      "-c",
      "core.autocrlf=true",
      "checkout",
      "HEAD",
      "--",
      ...hashed,
    ]);
    require("../desktop/protocol.cjs").verifyHtml(host);
    const info = JSON.parse(
      fs.readFileSync(path.join(host, "resources/BUILD_INFO.json")),
    );
    for (const name of hashed.slice(1))
      assert.equal(
        createHash("sha256")
          .update(fs.readFileSync(path.join(host, name)))
          .digest("hex"),
        info.presentationAssets[path.basename(name)],
      );
  }));
const html =
  '<small>V3.0.61</small><script>window.__GOD_POWER_VERSION__="V3.0.61";</script>\n';
function write(root, name, value) {
  const filename = path.join(root, name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}
function fixture(options, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gp361-sync-"));
  const sourceRoot = path.join(root, "godpower-html"),
    host = path.join(root, "godpower-electron");
  try {
    write(sourceRoot, "package.json", JSON.stringify({ version: "3.0.61" }));
    write(sourceRoot, "dist/godpower.html", html);
    write(
      sourceRoot,
      "scripts/build.mjs",
      `import {writeFileSync} from 'node:fs';writeFileSync('dist/godpower.html', ${JSON.stringify(options.badBuild ? "changed build" : html)});`,
    );
    if (!options.missingTooltip)
      for (const ext of ["js", "css"])
        write(sourceRoot, ext === "css" && options.canonicalStyles ? "src/styles/components/tooltips.css" : `src/ui/tooltips.${ext}`, `tooltip ${ext}\n`);
    if (options.canonicalStyles) write(sourceRoot,"src/ui/tooltips.css","stale legacy tooltip css\n");
    execFileSync("git", ["init", "-q", sourceRoot]);
    execFileSync("git", [
      "-C",
      sourceRoot,
      "-c",
      "core.autocrlf=false",
      "add",
      ".",
    ]);
    execFileSync("git", [
      "-C",
      sourceRoot,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "source fixture",
    ]);
    for (const target of targets) write(host, target, `old ${target}`);
    write(
      host,
      "package.json",
      JSON.stringify({ version: "3.0.60", name: "host", keep: true }),
    );
    write(
      host,
      "package-lock.json",
      JSON.stringify({
        version: "3.0.60",
        packages: { "": { version: "3.0.60" }, dependency: { version: "1" } },
      }),
    );
    fs.mkdirSync(path.join(host, "scripts"), { recursive: true });
    for (const name of fs.readdirSync(scripts))
      if (name.startsWith("sync-html") && name.endsWith(".mjs"))
        fs.copyFileSync(
          path.join(scripts, name),
          path.join(host, "scripts", name),
        );
    if (options.dirty)
      write(sourceRoot, "dirty.txt", "untracked source change");
    const before = Object.fromEntries(
      targets.map((name) => [name, fs.readFileSync(path.join(host, name))]),
    );
    const checkUnchanged = () => {
      for (const name of targets)
        assert.deepEqual(
          fs.readFileSync(path.join(host, name)),
          before[name],
          name,
        );
    };
    const cli = (extra = {}) =>
      spawnSync(process.execPath, [path.join(host, "scripts/sync-html.mjs")], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GODPOWER_HTML_REPO: sourceRoot,
          GODPOWER_HTML_SOURCE: "",
          ...extra,
        },
      });
    const outcome = run({
      root,
      sourceRoot,
      host,
      before,
      checkUnchanged,
      cli,
    });
    if (outcome?.then)
      return outcome.finally(() =>
        fs.rmSync(root, { recursive: true, force: true }),
      );
    fs.rmSync(root, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
for (const [name, options] of [
  ["source rebuild mismatch", { badBuild: true }],
  ["missing tooltip", { missingTooltip: true }],
  ["dirty source", { dirty: true }],
]) {
  test(`${name} leaves every host artifact and version byte unchanged`, () =>
    fixture(options, ({ cli, checkUnchanged }) => {
      const result = cli();
      assert.notEqual(result.status, 0);
      checkUnchanged();
    }));
}
test("missing committed source artifact leaves host version and files unchanged", () =>
  fixture({}, ({ cli, sourceRoot, checkUnchanged }) => {
    const result = cli({
      GODPOWER_HTML_SOURCE: path.join(sourceRoot, "dist/missing.html"),
    });
    assert.notEqual(result.status, 0);
    checkUnchanged();
  }));
test("successful sync keeps package, lock, HTML and tooltip provenance consistent", () =>
  fixture({}, ({ cli, host, sourceRoot }) => {
    const result = cli();
    assert.equal(result.status, 0, result.stderr);
    const pkg = JSON.parse(fs.readFileSync(path.join(host, "package.json"))),
      lock = JSON.parse(fs.readFileSync(path.join(host, "package-lock.json")));
    assert.equal(pkg.version, "3.0.61");
    assert.equal(pkg.keep, true);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[""].version, pkg.version);
    assert.equal(lock.packages.dependency.version, "1");
    const bytes = fs.readFileSync(path.join(host, "resources/index.html")),
      info = JSON.parse(
        fs.readFileSync(path.join(host, "resources/BUILD_INFO.json")),
      );
    assert.equal(bytes.toString(), html);
    assert.equal(
      info.htmlSha256,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(info.htmlBytes, bytes.length);
    assert.equal(
      info.sourceCommit,
      execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
    );
    for (const ext of ["js", "css"])
      assert.equal(
        info.presentationAssets[`tooltips.${ext}`],
        createHash("sha256")
          .update(fs.readFileSync(path.join(host, `renderer/tooltips.${ext}`)))
          .digest("hex"),
      );
  }));
for (const failedFile of [
  "package.json",
  "resources/BUILD_INFO.json",
  "renderer/tooltips.css",
])
  test("installation failure restores host files at " + failedFile, () =>
    fixture({}, async ({ host, sourceRoot, checkUnchanged }) => {
      const { syncHtml } = await import(
        pathToFileURL(path.join(scripts, "sync-html-support.mjs"))
      );
      let failed = false;
      const io = {
        ...fsp,
        rename: async (from, to) => {
          if (!failed && to === path.join(host, failedFile)) {
            failed = true;
            throw new Error("injected install failure");
          }
          return fsp.rename(from, to);
        },
      };
      await assert.rejects(
        syncHtml({
          root: host,
          source: path.join(sourceRoot, "dist/godpower.html"),
          io,
        }),
        /injected install failure/,
      );
      checkUnchanged();
    }),
  );

test("rollback removes newly created output when no previous artifact existed", () =>
  fixture({}, async ({ host, sourceRoot, before }) => {
    const missing = "resources/index.html";
    fs.unlinkSync(path.join(host, missing));
    const { syncHtml } = await import(
      pathToFileURL(path.join(scripts, "sync-html-support.mjs"))
    );
    const io = {
      ...fsp,
      rename: async (from, to) => {
        if (to === path.join(host, "renderer/tooltips.css"))
          throw new Error("late install failure");
        return fsp.rename(from, to);
      },
    };
    await assert.rejects(
      syncHtml({
        root: host,
        source: path.join(sourceRoot, "dist/godpower.html"),
        io,
      }),
      /late install failure/,
    );
    assert.equal(fs.existsSync(path.join(host, missing)), false);
    for (const name of targets.filter((name) => name !== missing))
      assert.deepEqual(
        fs.readFileSync(path.join(host, name)),
        before[name],
        name,
      );
    assert.equal(fs.existsSync(path.join(host, ".sync-html.lock")), false);
  }));


test("canonical CSS under styles is selected and tracked even when a stale ui CSS exists", () =>
 fixture({canonicalStyles:true},({cli,host})=>{
  const result=cli();
  assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(path.join(host,"renderer/tooltips.css"),"utf8"),"tooltip css\n");
  const info=JSON.parse(fs.readFileSync(path.join(host,"resources/BUILD_INFO.json")));
  assert.equal(info.presentationAssetSources["tooltips.css"],"src/styles/components/tooltips.css");
 }));
