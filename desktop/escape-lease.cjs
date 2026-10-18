"use strict";
// A presentation owns Escape only if its own registration succeeded.
class EscapeLease {
  constructor(shortcuts) {
    this.shortcuts = shortcuts;
    this.owned = false;
  }
  acquire(callback) {
    if (!this.owned) this.owned = this.shortcuts.register("Escape", callback);
    return this.owned;
  }
  release() {
    if (this.owned) this.shortcuts.unregister("Escape");
    this.owned = false;
  }
}
module.exports = { EscapeLease };
