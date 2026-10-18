"use strict";
const { randomUUID } = require("node:crypto");
const { validateCommand } = require("./contracts.cjs");
class Broker {
  constructor(send, { timeout = 12000, onChange = () => {} } = {}) {
    this.send = send;
    this.timeout = timeout;
    this.onChange = onChange;
    this.epoch = randomUUID();
    this.ready = false;
    this.pending = new Map();
    this.receipts = new Map();
    this.high = new Map();
    this.snapshot = null;
  }
  command(request, client) {
    try {
      if (!request || request.epoch !== this.epoch)
        return Promise.resolve({ ok: false, error: "STALE_EPOCH" });
      const { id, seq, action } = request;
      if (
        typeof id !== "string" ||
        !/^[\w-]{1,120}$/.test(id) ||
        !Number.isSafeInteger(seq) ||
        seq < 1
      )
        throw Error("INVALID_REQUEST");
      const payload = validateCommand(action, request.payload);
      const key = `${client}:${id}`,
        fingerprint = JSON.stringify({ seq, action, payload }),
        cached = this.receipts.get(key);
      if (cached)
        return cached.fingerprint === fingerprint
          ? cached.promise
          : Promise.resolve({ ok: false, error: "REQUEST_CONFLICT" });
      if (seq <= (this.high.get(client) || 0)) throw Error("STALE_REQUEST");
      this.high.set(client, seq);
      if (!this.ready) throw Error("MAIN_UNAVAILABLE");
      if (this.pending.size >= 8) throw Error("BUSY");
      const internal = randomUUID();
      let resolve;
      const promise = new Promise((r) => {
        resolve = r;
      });
      const timer = setTimeout(
        () => this.finish(internal, { ok: false, error: "COMMAND_TIMEOUT" }),
        this.timeout,
      );
      this.pending.set(internal, { resolve, timer, client });
      this.receipts.set(key, { promise, fingerprint });
      while (this.receipts.size > 256)
        this.receipts.delete(this.receipts.keys().next().value);
      try {
        this.send({ id: internal, action, payload });
      } catch {
        this.finish(internal, { ok: false, error: "MAIN_UNAVAILABLE" });
      }
      return promise;
    } catch (e) {
      return Promise.resolve({ ok: false, error: e.message });
    }
  }
  finish(id, result) {
    const p = this.pending.get(id);
    if (!p) return false;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(result);
    return true;
  }
  reply(message) {
    if (
      !message ||
      typeof message.id !== "string" ||
      typeof message.result?.ok !== "boolean"
    )
      return false;
    const result = { ok: message.result.ok };
    if (typeof message.result.error === "string")
      result.error = message.result.error.slice(0, 300);
    if (typeof message.result.persisted === "boolean")
      result.persisted = message.result.persisted;
    return this.finish(message.id, result);
  }
  dropClient(client) {
    for (const [id, p] of this.pending)
      if (p.client === client)
        this.finish(id, { ok: false, error: "CLIENT_CLOSED" });
    this.high.delete(client);
  }
  reset() {
    for (const id of this.pending.keys())
      this.finish(id, { ok: false, error: "MAIN_UNAVAILABLE" });
    this.epoch = randomUUID();
    this.ready = false;
    this.snapshot = null;
    this.receipts.clear();
    this.high.clear();
    this.onChange();
  }
}
module.exports = { Broker };
