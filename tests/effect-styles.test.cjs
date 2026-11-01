const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EFFECT_STYLES, pickEffectStyle, sanitizeSnapshot } = require("../desktop/contracts.cjs");

const snapshot = (style) => ({
  protocolVersion: 1,
  phase: "revealed",
  mode: "group",
  groups: [{ id: 1, name: "一组", color: "#123456", members: 2, score: 0 }],
  result: {
    id: "r1",
    mode: "group",
    groupId: 1,
    groupName: "一组",
    groupNo: 1,
    color: "#123456",
    score: 0,
    name: "一组",
    number: null,
  },
  slots: [1, 2, 5, -1, -2, -5],
  history: [],
  effects: { enabled: true, style, duration: 1800 },
});

test("exactly ten reveal styles exist and are stable identifiers", () => {
  assert.equal(EFFECT_STYLES.length, 10);
  assert.equal(new Set(EFFECT_STYLES).size, 10, "no duplicates");
  for (const name of EFFECT_STYLES) assert.match(name, /^[a-z]+$/);
});

test("every style is reachable by the random picker and keeps a requested one", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickEffectStyle(undefined));
  assert.deepEqual(
    [...seen].sort(),
    [...EFFECT_STYLES].sort(),
    "random selection covers all ten",
  );
  for (const name of EFFECT_STYLES)
    assert.equal(pickEffectStyle(name), name, "an explicit style is honoured");
});

test("an unknown or injected style falls back into the pool", () => {
  for (const bad of ["evil", "", null, 42, "<script>"])
    assert.ok(EFFECT_STYLES.includes(pickEffectStyle(bad)));
});

test("the snapshot keeps a valid style and never leaks an unknown one", () => {
  for (const name of EFFECT_STYLES)
    assert.equal(sanitizeSnapshot(snapshot(name)).effects.style, name);
  for (const bad of ["evil", "burst;drop", null, 7])
    assert.ok(EFFECT_STYLES.includes(sanitizeSnapshot(snapshot(bad)).effects.style));
});

test("the renderer defines a layer for all ten styles", () => {
  const css = fs.readFileSync(path.join(__dirname, "../renderer/effect.css"), "utf8");
  const windows = fs.readFileSync(
    path.join(__dirname, "../desktop/windows.cjs"),
    "utf8",
  );
  // aurora and burst rely on the shared base; the other eight are explicit rules.
  for (const name of EFFECT_STYLES)
    if (name !== "aurora")
      assert.match(
        css,
        new RegExp(`\\.${name}\\b`),
        `${name} needs a presentation layer`,
      );
  assert.equal(
    (windows.match(/pickEffectStyle\(value\.effects\?\.style\)/g) || []).length,
    2,
    "both the picker reveal and the item cinematic randomise",
  );
});
