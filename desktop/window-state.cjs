"use strict";
const fs = require("node:fs");
const path = require("node:path");
function visibleBounds(saved, displays, preferred) {
  const display =
    displays.find((d) => d.id === preferred) ||
    displays.find(
      (d) =>
        saved &&
        saved.x >= d.workArea.x &&
        saved.x < d.workArea.x + d.workArea.width &&
        saved.y >= d.workArea.y &&
        saved.y < d.workArea.y + d.workArea.height,
    ) ||
    displays[0];
  const a = display.workArea;
  const finite = (v, f) => (Number.isFinite(v) ? Math.round(v) : f);
  const width = Math.min(a.width, Math.max(360, finite(saved?.width, 480))),
    height = Math.min(a.height, Math.max(520, finite(saved?.height, 760)));
  return {
    x: Math.max(
      a.x,
      Math.min(
        a.x + a.width - width,
        finite(saved?.x, a.x + a.width - width - 24),
      ),
    ),
    y: Math.max(
      a.y,
      Math.min(a.y + a.height - height, finite(saved?.y, a.y + 30)),
    ),
    width,
    height,
  };
}
class WindowState {
  constructor(file) {
    this.file = file;
    this.value = {
      alwaysOnTop: true,
      effectsEnabled: true,
      displayId: null,
      pickerBounds: null,
    };
    try {
      const v = JSON.parse(fs.readFileSync(file, "utf8"));
      if (typeof v.alwaysOnTop === "boolean")
        this.value.alwaysOnTop = v.alwaysOnTop;
      if (typeof v.effectsEnabled === "boolean")
        this.value.effectsEnabled = v.effectsEnabled;
      if (Number.isSafeInteger(v.displayId)) this.value.displayId = v.displayId;
      if (
        v.pickerBounds &&
        ["x", "y", "width", "height"].every((k) =>
          Number.isFinite(v.pickerBounds[k]),
        )
      )
        this.value.pickerBounds = v.pickerBounds;
    } catch (e) {
      if (e.code !== "ENOENT")
        console.warn("Window preferences unavailable:", e.message);
    }
  }
  update(patch) {
    this.value = { ...this.value, ...patch };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.value, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error("Window preferences not saved:", e.message);
      return false;
    }
    return true;
  }
}
module.exports = { visibleBounds, WindowState };
