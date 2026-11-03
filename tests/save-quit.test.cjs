const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  vm = require("node:vm");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
test("quitting waits for accepted disk writes before closing windows", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-quit-"));
  const filename = path.resolve("desktop/windows.cjs"),
    localRequire = createRequire(filename),
    handlers = {};
  let quitCalls = 0,
    prevented = 0,
    closed = 0;
  const app = {
    getPath: () => dir,
    on: (name, fn) => {
      handlers[name] = fn;
    },
    quit: () => {
      quitCalls++;
      handlers["before-quit"]({ preventDefault: () => prevented++ });
    },
  };
  const electron = { app, screen: { on() {} }, globalShortcut: {} };
  const output = { exports: {} };
  const source = process.env.SAVE_LIFECYCLE_BASELINE
    ? execFileSync(
        "git",
        ["show", process.env.SAVE_LIFECYCLE_BASELINE + ":desktop/windows.cjs"],
        { encoding: "utf8" },
      )
    : fs.readFileSync(filename, "utf8");
  vm.runInNewContext(source, {
    require: (name) => (name === "electron" ? electron : localRequire(name)),
    module: output,
    __dirname: path.dirname(filename),
    console,
  });
  const { Windows } = output.exports;
  Windows.prototype.installIPC = () => {};
  Windows.prototype.savePicker = () => {};
  Windows.prototype.closeEffect = () => closed++;
  const windows = new Windows(dir);
  try {
    const writing = windows.saveFile.write({
      schemaVersion: 2,
      pad: "x".repeat(1024 * 1024),
    });
    handlers["before-quit"]({ preventDefault: () => prevented++ });
    assert.equal(prevented, 1);
    assert.equal(closed, 0);
    assert.equal((await writing).ok, true);
    await windows.saveFile.whenIdle();
    await Promise.resolve();
    assert.equal(quitCalls, 1);
    assert.equal(closed, 1);
    assert.equal(windows.saveFile.pendingWrites, 0);
    assert.equal(windows.saveFile.read().data.pad.length, 1024 * 1024);
  } finally {
    await windows.saveFile.whenIdle();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
