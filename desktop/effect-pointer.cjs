"use strict";
function skipRegion(value, bounds) {
  if (!value || typeof value !== "object") return null;
  const { left, top, width, height } = value;
  if (
    ![left, top, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    width > 600 ||
    height > 160 ||
    left < 0 ||
    top < 0 ||
    left + width > bounds.width ||
    top + height > bounds.height
  )
    return null;
  return { left, top, width, height };
}
function containsCursor(region, bounds, cursor) {
  const x = cursor.x - bounds.x,
    y = cursor.y - bounds.y;
  return (
    x >= region.left &&
    x <= region.left + region.width &&
    y >= region.top &&
    y <= region.top + region.height
  );
}
module.exports = { skipRegion, containsCursor };
