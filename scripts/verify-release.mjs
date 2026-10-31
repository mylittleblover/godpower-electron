import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
const require = createRequire(import.meta.url),
  asar = require("@electron/asar");
const {version}=JSON.parse(await readFile("package.json","utf8"));
const archive = path.resolve("release/win-unpacked/resources/app.asar");
const html = asar.extractFile(archive, "resources/index.html");
const info = JSON.parse(
  asar.extractFile(archive, "resources/BUILD_INFO.json").toString(),
);
const local = JSON.parse(await readFile("resources/BUILD_INFO.json", "utf8"));
assert.deepEqual(info, local);
assert.equal(createHash("sha256").update(html).digest("hex"), info.htmlSha256);
assert.equal(
  JSON.parse(asar.extractFile(archive, "package.json")).version,
  version,
);
for (const file of [
  "main.cjs",
  "build/icon.ico",
  "build/marx-icon.png",
  "build/classic-icon.png",
  "desktop/windows.cjs",
  "renderer/effect.js",
  "preload/desktop.cjs",
  "desktop/escape-lease.cjs",
  "renderer/picker.html",
  "renderer/picker.js",
  "renderer/effect.html",
  "renderer/effect.css",
])
  assert.ok(asar.extractFile(archive, file).length > 0, file);
for (const directory of ['desktop','preload','renderer']) {
  for (const file of await (await import('node:fs/promises')).readdir(directory)) {
    if (file.endsWith('-probe.cjs')) continue;
    const relative=directory+'/'+file;
    assert.ok(asar.extractFile(archive,relative).equals(await readFile(relative)), 'Archive must match final source: '+relative);
  }
}
assert.ok(asar.extractFile(archive,'main.cjs').equals(await readFile('main.cjs')));
const names = asar.listPackage(archive);
assert.ok(
  !names.some(
    (f) => f.endsWith("test-probe.cjs") || f.endsWith("smoke-probe.cjs"),
  ),
);
const zipName = `上帝的力量-${version}-win.zip`,
  zip = await readFile(path.join("release", zipName));
const result = {
  status: "PASS",
  version: version,
  source: info,
  zip: {
    name: zipName,
    bytes: zip.length,
    sha256: createHash("sha256").update(zip).digest("hex"),
  },
  bundledFiles: names,
};
const output=path.resolve(process.env.RELEASE_ARTIFACTS||"artifacts/electron-020");
await mkdir(output,{recursive:true});
await writeFile(
  path.join(output,"release-integrity.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { status: result.status, zip: result.zip, sourceCommit: info.sourceCommit },
    null,
    2,
  ),
);
