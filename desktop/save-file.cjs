"use strict";
/* A fixed classroom save file on disk. The renderer still owns classroom rules;
   this module only stores the same verified envelope that localStorage holds. */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const MAX_BYTES = 32 * 1024 * 1024;

function normalizeTarget(file) {
  if (typeof file !== "string" || !file.trim()) throw Error("INVALID_PATH");
  const raw = file.trim();
  // Reject relative input: silently resolving it against the process cwd would
  // put the classroom file somewhere the user never chose.
  if (!path.isAbsolute(raw)) throw Error("INVALID_PATH");
  const resolved = path.resolve(raw);
  if (path.extname(resolved).toLowerCase() !== ".json")
    throw Error("INVALID_EXTENSION");
  return resolved;
}

class SaveFile {
  constructor({ root, fileName = "classroom-save.json" }) {
    this.root = root;
    this.defaultDir = path.join(root, "saves");
    this.defaultPath = path.join(this.defaultDir, fileName);
    this.file = this.defaultPath;
  }
  get info() {
    let stat = null;
    try {
      stat = fs.statSync(this.file);
    } catch {
      stat = null;
    }
    return {
      path: this.file,
      directory: path.dirname(this.file),
      defaultPath: this.defaultPath,
      isDefault: this.file === this.defaultPath,
      exists: !!stat,
      bytes: stat ? stat.size : 0,
      modifiedAt: stat ? stat.mtimeMs : null,
    };
  }
  ensureDir() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }
  read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return { ok: true, present: false, data: null };
      return { ok: false, error: String(error.message || error) };
    }
    if (Buffer.byteLength(raw) > MAX_BYTES)
      return { ok: false, error: "存档文件过大，已拒绝读取" };
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw Error("存档不是对象");
      return {
        ok: true,
        present: true,
        data,
        bytes: Buffer.byteLength(raw),
        sha256: createHash("sha256").update(raw).digest("hex"),
      };
    } catch (error) {
      return { ok: false, error: "存档文件无法解析：" + String(error.message || error) };
    }
  }
  write(payload) {
    let text;
    try {
      text = JSON.stringify(payload);
    } catch (error) {
      return { ok: false, error: "存档无法序列化：" + String(error.message || error) };
    }
    if (Buffer.byteLength(text) > MAX_BYTES)
      return { ok: false, error: "存档体积超出上限，未写入" };
    try {
      this.ensureDir();
      // Atomic replace: a crash mid-write must never truncate the last good file.
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, text, "utf8");
      const check = fs.readFileSync(tmp, "utf8");
      if (check !== text) throw Error("写入后校验不一致");
      fs.renameSync(tmp, this.file);
      return { ok: true, bytes: Buffer.byteLength(text), info: this.info };
    } catch (error) {
      try {
        fs.rmSync(`${this.file}.tmp`, { force: true });
      } catch {}
      return { ok: false, error: String(error.message || error) };
    }
  }
  choose(file) {
    const target = normalizeTarget(file);
    let stat = null;
    try {
      stat = fs.statSync(target);
    } catch {
      stat = null;
    }
    if (stat && !stat.isFile()) throw Error("目标不是文件");
    // Never adopt a different file silently: reading happens on next load.
    this.file = target;
    return this.info;
  }
  reset() {
    this.file = this.defaultPath;
    return this.info;
  }
}

module.exports = { SaveFile, normalizeTarget, MAX_BYTES };
