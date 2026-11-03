const test = require("node:test"),
  assert = require("node:assert/strict");
const { SaveFlush } = require("../desktop/save-flush.cjs");
test("renderer preprocessing must acknowledge before native quit can proceed", async () => {
  const sent = [];
  const flush = new SaveFlush((message) => sent.push(message));
  const first = flush.request(),
    second = flush.request();
  assert.equal(first, second);
  assert.equal(sent.length, 1);
  let settled = false;
  first.then(() => (settled = true));
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(flush.reply({ id: "stale", ok: true }), false);
  assert.equal(flush.reply({ id: sent[0].id, ok: true }), true);
  assert.equal((await first).ok, true);
});
test("flush errors and missing responses are explicit failures, never success", async () => {
  const sent = [];
  const flush = new SaveFlush((message) => sent.push(message), { timeout: 15 });
  const first = flush.request();
  flush.reply({ id: sent[0].id, ok: false, error: "保存失败" });
  assert.equal((await first).ok, false);
  const timed = await flush.request();
  assert.equal(timed.ok, false);
  assert.equal(timed.error, "RENDERER_FLUSH_TIMEOUT");
});
