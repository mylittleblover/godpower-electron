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
test("hand and item avatars accept only bounded local WebP data", () => {
  const { sanitizeItemFx } = require("../desktop/contracts.cjs");
  const webp = "data:image/webp;base64,UklGRg==";
  const snapshot = {
    protocolVersion: 1,
    phase: "idle",
    mode: "individual",
    groups: [{ id: 1, name: "A", score: 0, members: 4, color: "#109080" }],
    slots: [1, 2, 3, 4, 5, 6],
    history: [],
    hand: { groupId: 1, selectionId: "s", avatarDataUrl: webp },
  };
  assert.equal(sanitizeSnapshot(snapshot).hand.avatarDataUrl, webp);
  const item = {
    key: "coin",
    caster: "A",
    casterAvatarDataUrl: webp,
    targets: [{ name: "B", avatarDataUrl: webp }],
  };
  assert.equal(sanitizeItemFx(item).casterAvatarDataUrl, webp);
  assert.equal(sanitizeItemFx(item).targets[0].avatarDataUrl, webp);
  for (const bad of [
    "https://example.com/avatar.jpg",
    "data:image/svg+xml;base64,PHN2Zz4=",
    webp + "A".repeat(180001),
  ]) {
    assert.equal(
      sanitizeItemFx({ ...item, casterAvatarDataUrl: bad }).casterAvatarDataUrl,
      "",
    );
    assert.equal(
      sanitizeSnapshot({
        ...snapshot,
        hand: { ...snapshot.hand, avatarDataUrl: bad },
      }).hand.avatarDataUrl,
      "",
    );
  }
});
test("personal reveal preserves separate student and group avatar DTOs", () => {
  const webp = "data:image/webp;base64,UklGRg==";
  const base = {
    protocolVersion: 1,
    phase: "revealed",
    mode: "individual",
    groups: [{ id: 1, name: "A", score: 0, members: 4, color: "#109080" }],
    slots: [1, 2, 3, 4, 5, 6],
    history: [],
    result: {
      id: "pick-1",
      mode: "individual",
      groupId: 1,
      groupName: "A",
      groupNo: 1,
      color: "#109080",
      score: 0,
      name: "Student",
      number: "01",
      memberName: "01 Student",
      avatarDataUrl: webp,
      groupAvatarDataUrl: webp,
    },
  };
  const r = sanitizeSnapshot(base).result;
  assert.equal(r.avatarDataUrl, webp);
  assert.equal(r.groupAvatarDataUrl, webp);
  assert.equal(
    sanitizeSnapshot({
      ...base,
      result: { ...base.result, groupAvatarDataUrl: "https://invalid/avatar" },
    }).result.groupAvatarDataUrl,
    "",
  );
});

test('floating groups retain their display number and hand draw icons stay bounded and local',()=>{
 const image='data:image/webp;base64,UklGRg==';
 const base={protocolVersion:1,phase:'idle',mode:'individual',groups:[{id:170000000,groupNo:7,name:'自定义组',score:0,members:4,color:'#123456'}],slots:[1,2,3,-1,-2,-3],history:[],hand:{groupId:170000000,selectionId:'s',itemName:'金币',itemIcon:image}};
 assert.equal(sanitizeSnapshot(base).groups[0].groupNo,7);
 assert.equal(sanitizeSnapshot(base).hand.itemIcon,image);
 for(const value of ['https://external/image.png','javascript:alert(1)','data:image/webp;base64,'+'A'.repeat(400001)])
  assert.equal(sanitizeSnapshot({...base,hand:{...base.hand,itemIcon:value}}).hand.itemIcon,'');
});
