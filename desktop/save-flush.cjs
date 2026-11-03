"use strict";
const { randomUUID } = require("node:crypto");
/* A renderer may still be hashing/preparing a document before native I/O starts. */
class SaveFlush {
  constructor(send, { timeout = 15000 } = {}) {
    this.send = send;
    this.timeout = timeout;
    this.pending = null;
  }
  request() {
    if (this.pending) return this.pending.promise;
    const id = randomUUID();
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const pending = { id, promise, resolve, timer: null };
    this.pending = pending;
    pending.timer = setTimeout(
      () => this.finish({ ok: false, error: "RENDERER_FLUSH_TIMEOUT" }),
      this.timeout,
    );
    try {
      this.send({ id });
    } catch (error) {
      this.finish({ ok: false, error: String(error.message || error) });
    }
    return promise;
  }
  finish(result) {
    const pending = this.pending;
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve({ ...result, id: pending.id });
    return true;
  }
  reply(message) {
    if (
      !message ||
      message.id !== this.pending?.id ||
      typeof message.ok !== "boolean"
    )
      return false;
    return this.finish({
      ok: message.ok,
      ...(!message.ok
        ? {
            error:
              typeof message.error === "string"
                ? message.error.slice(0, 300)
                : "RENDERER_FLUSH_FAILED",
          }
        : {}),
    });
  }
}
module.exports = { SaveFlush };
