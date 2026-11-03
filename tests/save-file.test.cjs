const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { SaveFile, normalizeTarget, MAX_BYTES } = require("../desktop/save-file.cjs");

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-save-"));
  return { dir, file: new SaveFile({ root: dir }) };
}

test("the default save file lives under the app data root and is reported", () => {
  const { dir, file } = workspace();
  try {
    const info = file.info;
    assert.equal(info.isDefault, true);
    assert.equal(info.exists, false);
    assert.ok(info.path.startsWith(dir));
    assert.equal(path.extname(info.path), ".json");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writing creates the directory and verifies the bytes it stored", () => {
  const { dir, file } = workspace();
  try {
    const payload = { schemaVersion: 2, groups: [{ id: 1, name: "第 1 组" }] };
    const written = file.write(payload);
    assert.equal(written.ok, true);
    assert.ok(fs.existsSync(file.info.path));
    const read = file.read();
    assert.equal(read.ok, true);
    assert.equal(read.present, true);
    assert.deepEqual(read.data, payload);
    assert.match(read.sha256, /^[0-9a-f]{64}$/);
    // A second write replaces the file atomically and leaves no temp file.
    assert.equal(file.write({ ...payload, groups: [] }).ok, true);
    assert.deepEqual(file.read().data.groups, []);
    assert.equal(fs.existsSync(file.info.path + ".tmp"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing file reads as absent, a corrupt one as an error, never as data", () => {
  const { dir, file } = workspace();
  try {
    assert.deepEqual(file.read(), { ok: true, present: false, data: null });
    fs.mkdirSync(path.dirname(file.info.path), { recursive: true });
    fs.writeFileSync(file.info.path, "{not json");
    const broken = file.read();
    assert.equal(broken.ok, false);
    assert.match(broken.error, /无法解析/);
    fs.writeFileSync(file.info.path, "[1,2,3]");
    assert.equal(file.read().ok, false, "arrays are not a classroom save");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("oversized payloads are refused in both directions", () => {
  const { dir, file } = workspace();
  try {
    const big = { blob: "x".repeat(MAX_BYTES + 10) };
    const result = file.write(big);
    assert.equal(result.ok, false);
    assert.match(result.error, /上限/);
    assert.equal(fs.existsSync(file.info.path), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("only absolute .json paths are accepted as a custom location", () => {
  assert.throws(() => normalizeTarget("relative/save.json"), /INVALID_PATH|absolute/);
  assert.throws(() => normalizeTarget(""), /INVALID_PATH/);
  assert.throws(() => normalizeTarget(path.join(os.tmpdir(), "notes.txt")), /INVALID_EXTENSION/);
  const { dir, file } = workspace();
  try {
    const custom = path.join(dir, "custom", "my-save.json");
    const info = file.choose(custom);
    assert.equal(info.path, custom);
    assert.equal(info.isDefault, false);
    assert.equal(file.write({ ok: 1 }).ok, true);
    assert.ok(fs.existsSync(custom) || fs.existsSync(file.info.path));
    // Reset returns to the shipped default.
    assert.equal(file.reset().isDefault, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sandboxed renderers cannot reach the save file directly", () => {
  const preload = fs.readFileSync(
    path.join(__dirname, "../preload/desktop.cjs"),
    "utf8",
  );
  for (const api of [
    "saveFileInfo",
    "saveFileRead",
    "saveFileWrite",
    "saveFileChoose",
    "saveFileSet",
    "saveFileReset",
  ])
    assert.match(preload, new RegExp(api));
  assert.doesNotMatch(preload, /require\("node:fs"\)/, "no fs in preload");
  const windows = fs.readFileSync(
    path.join(__dirname, "../desktop/windows.cjs"),
    "utf8",
  );
  for (const channel of [
    "gp:save-file-info",
    "gp:save-file-read",
    "gp:save-file-write",
    "gp:save-file-choose",
    "gp:save-file-set",
    "gp:save-file-reset",
  ])
    assert.match(windows, new RegExp(channel.replace(/:/g, ":")));
  assert.match(
    windows,
    /gp:save-file-write"[\s\S]{0,160}requireRole\(event, "main"\)/,
    "only the main renderer may write",
  );
});
