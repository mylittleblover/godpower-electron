const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { sanitizeSnapshot } = require(
  process.env.HAND_CONTRACT_MODULE || "../desktop/contracts.cjs",
);
test("hand DTO preserves bounded phase and prevents completed rewards from enabling controls", () => {
  const base = {
    protocolVersion: 1,
    phase: "idle",
    mode: "individual",
    groups: [{ id: 1, name: "一组", score: 2, members: 4, color: "#123456" }],
    slots: [1, 2, 3, -1, -2, -3],
    history: [],
    preview: {},
    effects: { enabled: true },
    hand: {
      groupId: 1,
      selectionId: "hand-1",
      correct: true,
      phase: "SELECT_GROUP",
      rewardComplete: true,
      canScore: true,
      canDraw: true,
      canUse: true,
    },
  };
  const hand = sanitizeSnapshot(base).hand;
  assert.equal(hand.phase, "SELECT_GROUP");
  assert.equal(hand.rewardComplete, true);
  assert.equal(hand.canScore, false);
  assert.equal(hand.canDraw, false);
  assert.equal(hand.canUse, false);
});
test("fullscreen card requests stay inside their displayed selection and active save", () => {
  const api = fs.existsSync("desktop/hand-cards.cjs")
    ? require("../desktop/hand-cards.cjs")
    : {};
  assert.equal(typeof api.validateHandCardRequest, "function");
  const context = { saveId: "save-A", generation: 1 },
    active = {
      id: "effect-1",
      kind: "hand",
      saveContext: context,
      hand: { groupId: 1, selectionId: "hand-1", phase: "JUDGE" },
    },
    request = {
      id: "effect-1",
      commandId: "card-1",
      seq: 1,
      action: "handJudge",
      payload: { groupId: 1, selectionId: "hand-1", correct: true },
    };
  assert.equal(
    api.validateHandCardRequest(active, request, context).action,
    "handJudge",
  );
  for (const mutation of [
    { id: "effect-old" },
    { action: "score", payload: { delta: 1, resultId: "x" } },
    { payload: { groupId: 2, selectionId: "hand-1", correct: true } },
    { payload: { groupId: 1, selectionId: "old", correct: true } },
  ])
    assert.throws(() =>
      api.validateHandCardRequest(active, { ...request, ...mutation }, context),
    );
  assert.throws(() =>
    api.validateHandCardRequest(active, request, {
      saveId: "save-B",
      generation: 2,
    }),
  );
  assert.throws(() =>
    api.validateHandCardRequest({ ...active, kind: "item" }, request, context),
  );
});
