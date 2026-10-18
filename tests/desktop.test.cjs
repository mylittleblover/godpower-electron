const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCommand,
  authorize,
  sanitizeSnapshot,
} = require("../desktop/contracts.cjs");
const { Broker } = require("../desktop/broker.cjs");
const { visibleBounds } = require("../desktop/window-state.cjs");
test("reject unknown commands, arbitrary IPC, invalid scores and modes", () => {
  for (const action of ["eval", "openFile", "shell"])
    assert.throws(() => validateCommand(action, {}));
  assert.throws(() => validateCommand("mode", { mode: "other" }));
  assert.throws(() =>
    validateCommand("score", { delta: Infinity, resultId: "x" }),
  );
  assert.throws(() => validateCommand("start", { node: "x" }));
  assert.deepEqual(
    validateCommand("score", { delta: -5, resultId: "pick-1" }),
    { delta: -5, resultId: "pick-1" },
  );
});
test("authorize exact webContents, main frame and URL", () => {
  const frame = { url: "classroom://picker/index.html" },
    wc = { mainFrame: frame },
    win = { webContents: wc, isDestroyed: () => false };
  assert.equal(
    authorize({ sender: wc, senderFrame: frame }, win, frame.url),
    true,
  );
  assert.equal(
    authorize({ sender: wc, senderFrame: { url: frame.url } }, win, frame.url),
    false,
  );
  assert.equal(
    authorize(
      { sender: wc, senderFrame: frame },
      win,
      "classroom://app/index.html",
    ),
    false,
  );
});
test("snapshot rejects malformed payload, oversized arrays and injected result data", () => {
  assert.throws(() => sanitizeSnapshot({ groups: Array(1001).fill({}) }));
  assert.throws(() =>
    sanitizeSnapshot({ phase: "revealed", result: { name: "x" } }),
  );
});
function command(b, id = 1, action = "start", payload = {}) {
  return b.command(
    { id: `request-${id}`, seq: id, epoch: b.epoch, action, payload },
    7,
  );
}
test("concurrent replay dispatches once; changed payload cannot reuse id", async () => {
  const sent = [];
  const b = new Broker((m) => sent.push(m));
  b.ready = true;
  const one = command(b);
  const two = command(b);
  assert.equal(sent.length, 1);
  assert.equal((await command(b, 1, "stop")).error, "REQUEST_CONFLICT");
  b.reply({ id: sent[0].id, result: { ok: true } });
  assert.deepEqual(await one, await two);
  b.reset();
});
test("reload rejects pending score without replay; stale epochs rejected", async () => {
  const sent = [];
  const b = new Broker((m) => sent.push(m));
  b.ready = true;
  const p = command(b);
  const epoch = b.epoch;
  b.reset();
  assert.equal((await p).error, "MAIN_UNAVAILABLE");
  assert.equal(
    (
      await b.command(
        { id: "old", seq: 2, epoch, action: "start", payload: {} },
        7,
      )
    ).error,
    "STALE_EPOCH",
  );
  assert.equal(sent.length, 1);
});
test("timeout fails once and ignores late acknowledgement", async () => {
  const sent = [];
  const b = new Broker((m) => sent.push(m), { timeout: 10 });
  b.ready = true;
  const r = await command(b);
  assert.equal(r.error, "COMMAND_TIMEOUT");
  assert.equal(b.reply({ id: sent[0].id, result: { ok: true } }), false);
  b.reset();
});
test("closed secondary window cleanup cancels receipts and cannot replay later", async () => {
  const b = new Broker(() => {});
  b.ready = true;
  const p = command(b);
  b.dropClient(7);
  assert.equal((await p).error, "CLIENT_CLOSED");
  b.reset();
});
test("removed displays and oversized saved windows are clamped into visible work area", () => {
  const area = { x: 1920, y: 0, width: 1920, height: 1080 };
  const r = visibleBounds(
    { x: -5000, y: 6000, width: 4000, height: 4000 },
    [{ id: 2, workArea: area }],
    2,
  );
  assert.ok(r.x >= area.x && r.y >= area.y);
  assert.ok(r.x + r.width <= area.x + area.width);
  assert.ok(r.y + r.height <= area.y + area.height);
});
test("window preferences survive a new store instance and malformed files fall back safely", () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const { WindowState } = require("../desktop/window-state.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-window-state-")),
    file = path.join(dir, "state.json");
  try {
    const s = new WindowState(file);
    assert.equal(
      s.update({
        alwaysOnTop: false,
        effectsEnabled: false,
        displayId: 2,
        pickerBounds: { x: 20, y: 40, width: 480, height: 760 },
      }),
      true,
    );
    const restored = new WindowState(file);
    assert.equal(restored.value.alwaysOnTop, false);
    assert.equal(restored.value.displayId, 2);
    assert.equal(restored.value.pickerBounds.width, 480);
    fs.writeFileSync(file, "broken json");
    assert.equal(new WindowState(file).value.alwaysOnTop, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("detached functional windows use frameless resizable native windows", () => {
  const { detachedWindowOptions } = require("../desktop/detached.cjs");
  const options = detachedWindowOptions(
    { id: "scoreModalBackdrop", title: "自由赋分" },
    { contextIsolation: true, sandbox: true, webSecurity: true },
  );
  assert.equal(options.frame, false);
  assert.equal(options.resizable, true);
  assert.equal(options.width, 600);
  assert.equal(options.title, "自由赋分");
  assert.equal(options.webPreferences.sandbox, true);
});
test("bundled HTML verifies SHA-256 and rejects any changed byte", () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path"),
    crypto = require("node:crypto");
  const { verifyHtml } = require("../desktop/protocol.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-bundle-"));
  fs.mkdirSync(path.join(dir, "resources"));
  const html = "<html>offline</html>",
    info = {
      sourceCommit: "a".repeat(40),
      htmlSha256: crypto.createHash("sha256").update(html).digest("hex"),
      htmlBytes: Buffer.byteLength(html),
    };
  try {
    fs.writeFileSync(path.join(dir, "resources/index.html"), html);
    fs.writeFileSync(
      path.join(dir, "resources/BUILD_INFO.json"),
      JSON.stringify(info),
    );
    assert.deepEqual(verifyHtml(dir), info);
    fs.appendFileSync(path.join(dir, "resources/index.html"), "!");
    assert.throws(() => verifyHtml(dir), /integrity/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("valid snapshots strip private state and preserve display data without HTML interpretation", () => {
  const dto = sanitizeSnapshot({
    protocolVersion: 1,
    phase: "idle",
    mode: "individual",
    groups: [
      {
        id: 1,
        name: "<script>甲</script>",
        color: "javascript:alert(1)",
        members: 2,
        score: 8,
      },
    ],
    slots: [1, 2, 5, -1, -2, -5],
    history: [],
    preview: {},
    adminPin: "private",
    effects: { enabled: true },
  });
  assert.equal(dto.adminPin, undefined);
  assert.equal(dto.groups[0].color, "#0f766e");
  assert.equal(dto.groups[0].name, "<script>甲</script>");
});
test("Escape ownership survives duplicate readiness and is released exactly once", () => {
  const { EscapeLease } = require("../desktop/escape-lease.cjs");
  let registered = false,
    calls = 0,
    released = 0;
  const shortcut = {
    register() {
      calls++;
      if (registered) return false;
      registered = true;
      return true;
    },
    unregister() {
      released++;
      registered = false;
    },
  };
  const lease = new EscapeLease(shortcut);
  lease.acquire(() => {});
  lease.acquire(() => {});
  assert.equal(calls, 1);
  lease.release();
  lease.release();
  assert.equal(registered, false);
  assert.equal(released, 1);
});
