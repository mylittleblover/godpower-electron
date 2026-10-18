const { test } = require("node:test");
const assert = require("node:assert/strict");
const { iconBounds } = require("../desktop/window-state.cjs");
const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
];
test("icon stays 72px and is clamped to work area", () => {
  assert.deepEqual(iconBounds({ x: 9999, y: -100 }, displays), {
    x: 1848,
    y: 0,
    width: 72,
    height: 72,
  });
});
test("icon restores saved position independently from expanded bounds", () => {
  assert.deepEqual(
    iconBounds({ x: 80, y: 90, width: 480, height: 760 }, displays),
    { x: 80, y: 90, width: 72, height: 72 },
  );
});
