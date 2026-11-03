const test = require("node:test"),
  assert = require("node:assert/strict");
const { Broker } = require("../desktop/broker.cjs");
test("switching saves rotates IPC epoch and cancels old requests even when numeric group IDs match", async () => {
  const messages = [];
  const broker = new Broker((m) => messages.push(m));
  broker.ready = true;
  broker.acceptSnapshot({
    saveContext: { saveId: "save-first", generation: 1 },
    groups: [{ id: 1 }],
  });
  const oldEpoch = broker.epoch;
  const pending = broker.command(
    {
      id: "old-1",
      seq: 1,
      epoch: oldEpoch,
      action: "mode",
      payload: { mode: "group" },
    },
    1,
  );
  assert.equal(messages[0].saveContext.saveId, "save-first");
  broker.acceptSnapshot({
    saveContext: { saveId: "save-second", generation: 2 },
    groups: [{ id: 1 }],
  });
  assert.equal((await pending).error, "SAVE_CHANGED");
  assert.notEqual(broker.epoch, oldEpoch);
  assert.equal(broker.ready, true);
  assert.equal(
    (
      await broker.command(
        { id: "old-2", seq: 2, epoch: oldEpoch, action: "start", payload: {} },
        1,
      )
    ).error,
    "STALE_EPOCH",
  );
  assert.equal(
    broker.reply({ id: messages[0].id, result: { ok: true } }),
    false,
  );
  assert.equal(messages.length, 1);
});
test("publishing a score update within the same save keeps active IPC requests valid", async () => {
  const messages = [];
  const broker = new Broker((m) => messages.push(m));
  broker.ready = true;
  const saveContext = { saveId: "save-one", generation: 3 };
  broker.acceptSnapshot({ saveContext });
  const epoch = broker.epoch;
  const pending = broker.command(
    { id: "new-1", seq: 1, epoch, action: "start", payload: {} },
    1,
  );
  broker.acceptSnapshot({ saveContext, score: 10 });
  assert.equal(broker.epoch, epoch);
  broker.reply({ id: messages[0].id, result: { ok: true } });
  assert.equal((await pending).ok, true);
});
