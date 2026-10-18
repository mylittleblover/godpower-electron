import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { verifyHtml } = require("../desktop/protocol.cjs");
console.log(
  JSON.stringify(
    verifyHtml(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    ),
    null,
    2,
  ),
);

const {version}=JSON.parse(await readFile('package.json','utf8'));
const html=await readFile('resources/index.html','utf8');
assert.ok(html.includes(`<small>V${version}</small>`),'Visible HTML must match Electron package version');
assert.ok(html.includes(`window.__GOD_POWER_VERSION__='V${version}'`),'Internal HTML must match Electron package version');
console.log(`Visible, internal and Electron package version match: ${version}`);

const info=JSON.parse(await readFile('resources/BUILD_INFO.json','utf8'));
for(const [name,sha] of Object.entries(info.presentationAssets||{})) assert.equal(createHash('sha256').update(await readFile('renderer/'+name)).digest('hex'),sha,'Presentation asset must match HTML source: '+name);
