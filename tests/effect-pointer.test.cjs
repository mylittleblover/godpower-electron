const test = require("node:test"),
  assert = require("node:assert/strict"),
  { skipRegion, containsCursor } = require("../desktop/effect-pointer.cjs");
test("skip hit area is bounded to the active effect and maps monitor coordinates", () => {
  const b = { x: 1920, y: 0, width: 1920, height: 1080 },
    r = skipRegion({ left: 1740, top: 1000, width: 140, height: 48 }, b);
  assert.ok(r);
  assert.equal(containsCursor(r, b, { x: 3680, y: 1010 }), true);
  assert.equal(containsCursor(r, b, { x: 2000, y: 1010 }), false);
  for (const bad of [
    { left: 0, top: 0, width: 1920, height: 1080 },
    { left: -1, top: 0, width: 10, height: 10 },
    { left: 1900, top: 0, width: 40, height: 10 },
  ])
    assert.equal(skipRegion(bad, b), null);
});
