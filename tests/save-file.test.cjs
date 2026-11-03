const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SaveFile,
  normalizeTarget,
  MAX_BYTES,
} = require("../desktop/save-file.cjs");

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

test("writing creates the directory and verifies the bytes it stored", async () => {
  const { dir, file } = workspace();
  try {
    const payload = { schemaVersion: 2, groups: [{ id: 1, name: "第 1 组" }] };
    const written = await file.write(payload);
    assert.equal(written.ok, true);
    assert.ok(fs.existsSync(file.info.path));
    const read = file.read();
    assert.equal(read.ok, true);
    assert.equal(read.present, true);
    assert.deepEqual(read.data, payload);
    assert.match(read.sha256, /^[0-9a-f]{64}$/);
    // A second write replaces the file atomically and leaves no temp file.
    assert.equal((await file.write({ ...payload, groups: [] })).ok, true);
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

test("oversized payloads are refused in both directions", async () => {
  const { dir, file } = workspace();
  try {
    const big = { blob: "x".repeat(MAX_BYTES + 10) };
    const result = await file.write(big);
    assert.equal(result.ok, false);
    assert.match(result.error, /上限/);
    assert.equal(fs.existsSync(file.info.path), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("only absolute .json paths are accepted as a custom location", async () => {
  assert.throws(
    () => normalizeTarget("relative/save.json"),
    /INVALID_PATH|absolute/,
  );
  assert.throws(() => normalizeTarget(""), /INVALID_PATH/);
  assert.throws(
    () => normalizeTarget(path.join(os.tmpdir(), "notes.txt")),
    /INVALID_EXTENSION/,
  );
  const { dir, file } = workspace();
  try {
    const custom = path.join(dir, "custom", "my-save.json");
    const info = file.choose(custom);
    assert.equal(info.path, custom);
    assert.equal(info.isDefault, false);
    assert.equal((await file.write({ ok: 1 })).ok, true);
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

test("writes yield the host event loop before disk verification completes", async () => {
  const { dir, file } = workspace();
  try {
    let yielded = false;
    setImmediate(() => {
      yielded = true;
    });
    const result = await file.write({
      schemaVersion: 2,
      groups: [],
      pad: "x".repeat(1024 * 1024),
    });
    assert.equal(result.ok, true);
    assert.equal(
      yielded,
      true,
      "file I/O must yield so other windows remain responsive",
    );
    assert.equal(file.read().data.pad.length, 1024 * 1024);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rapid writes remain ordered, drainable and atomic", async () => {
  const { dir, file } = workspace();
  try {
    const writes = Array.from({ length: 8 }, (_, i) =>
      file.write({ schemaVersion: 2, sequence: i }),
    );
    assert.ok(file.pendingWrites > 0);
    await file.whenIdle();
    const results = await Promise.all(writes);
    assert.ok(results.every((r) => r.ok));
    assert.equal(file.pendingWrites, 0);
    assert.equal(file.read().data.sequence, 7);
    assert.equal(fs.existsSync(file.info.path + ".tmp"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an accepted write keeps its original target when the selected path changes", async () => {
  const { dir, file } = workspace();
  try {
    const original = file.file;
    const first = file.write({ sequence: 1 });
    const secondPath = path.join(dir, "other.json");
    file.choose(secondPath);
    const second = file.write({ sequence: 2 });
    assert.equal((await first).ok, true);
    assert.equal((await second).ok, true);
    assert.equal(JSON.parse(fs.readFileSync(original, "utf8")).sequence, 1);
    assert.equal(JSON.parse(fs.readFileSync(secondPath, "utf8")).sequence, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("failed replacement preserves the last good file and the queue recovers", async () => {
  const { dir, file } = workspace();
  try {
    assert.equal((await file.write({ sequence: 1 })).ok, true);
    fs.mkdirSync(file.file + ".tmp");
    const failed = await file.write({ sequence: 2 });
    assert.equal(failed.ok, false);
    assert.equal(file.read().data.sequence, 1);
    fs.rmSync(file.file + ".tmp", { recursive: true, force: true });
    assert.equal((await file.write({ sequence: 3 })).ok, true);
    await file.whenIdle();
    assert.equal(file.pendingWrites, 0);
    assert.equal(file.read().data.sequence, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
