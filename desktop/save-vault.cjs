"use strict";
/* Immutable resources/revisions are staged first. index.json is the sole commit
   point, so a failed publication can never replace the prior classroom. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const MAX_BYTES = 128 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (v) => JSON.parse(JSON.stringify(v));
const fail = (code, message = code) => {
  throw Object.assign(Error(message), { code });
};
const digestId = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validSaveId = (value) =>
  typeof value === "string" && /^save-[A-Za-z0-9_-]{1,96}$/.test(value);
const emptyIndex = () => ({
  kind: "godpower.save-index",
  schemaVersion: 2,
  revision: 0,
  generation: 0,
  activeSaveId: null,
  entries: [],
  imports: {},
});
class SaveVault {
  constructor({ root, schema }) {
    if (!schema?.validateV2 || !path.isAbsolute(root))
      throw Error("INVALID_VAULT_CONFIGURATION");
    this.root = root;
    this.schema = schema;
    this.pending = Promise.resolve();
    this.pendingWrites = 0;
  }
  whenIdle() {
    return this.pending;
  }
  enqueue(operation) {
    this.pendingWrites++;
    const run = async () => {
      try {
        return await operation();
      } catch (error) {
        return {
          ok: false,
          code: error.code || error.name || "STORAGE_ERROR",
          message: error.message,
        };
      } finally {
        this.pendingWrites--;
      }
    };
    this.pending = this.pending.then(run, run);
    return this.pending;
  }
  async readOptional(file) {
    try {
      return await fs.readFile(file);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async readIndex() {
    const bytes = await this.readOptional(path.join(this.root, "index.json"));
    if (!bytes) return emptyIndex();
    const index = this.schema.validateIndex(JSON.parse(bytes.toString("utf8")));
    // Paths are always reconstructed; never trust a path from a renderer or index.
    for (const e of [...index.entries, ...(index.trashedEntries || [])])
      if (!validSaveId(e.saveId) || !digestId(e.contentHash))
        fail("INVALID_INDEX_ENTRY");
    if (
      !index.imports ||
      typeof index.imports !== "object" ||
      Array.isArray(index.imports)
    )
      fail("INVALID_IMPORT_RECEIPTS");
    return index;
  }
  async atomicWrite(file, bytes) {
    if (bytes.length > MAX_BYTES) fail("SIZE_LIMIT");
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + "." + randomUUID() + ".tmp";
    try {
      const handle = await fs.open(temporary, "wx");
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      const readback = await fs.readFile(temporary);
      if (!readback.equals(bytes)) fail("VERIFY_FAILED");
      await fs.rename(temporary, file);
    } catch (error) {
      try {
        await fs.rm(temporary, { force: true });
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          "write and temporary cleanup failed",
        );
      }
      throw error;
    }
  }
  async publish(index) {
    this.schema.validateIndex(index);
    await this.atomicWrite(
      path.join(this.root, "index.json"),
      Buffer.from(JSON.stringify(index)),
    );
  }
  async immutable(file, bytes) {
    const old = await this.readOptional(file);
    if (old) {
      if (!old.equals(bytes)) fail("IMMUTABLE_CONTENT_CONFLICT");
      return;
    }
    await this.atomicWrite(file, bytes);
  }
  async stageDocument(doc) {
    const bytes = Buffer.from(JSON.stringify(doc)),
      contentHash = hash(bytes);
    await this.immutable(
      path.join(this.root, "documents", doc.saveId, contentHash + ".json"),
      bytes,
    );
    return {
      saveId: doc.saveId,
      name: doc.name,
      revision: doc.revision,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      contentHash,
      bytes: bytes.length,
    };
  }
  async readDocument(index, saveId) {
    if (!validSaveId(saveId)) fail("INVALID_SAVE_ID");
    const entry = index.entries.find((e) => e.saveId === saveId);
    if (!entry) fail("SAVE_NOT_FOUND");
    const bytes = await fs.readFile(
      path.join(this.root, "documents", saveId, entry.contentHash + ".json"),
    );
    if (hash(bytes) !== entry.contentHash || bytes.length !== entry.bytes)
      fail("DOCUMENT_INTEGRITY_FAILED");
    const doc = this.schema.validateV2(JSON.parse(bytes.toString("utf8")));
    if (doc.saveId !== saveId || doc.revision !== entry.revision)
      fail("REVISION_INTEGRITY_FAILED");
    return doc;
  }
  async stageAssets(assets) {
    for (const asset of assets) {
      if (
        !asset ||
        typeof asset.dataBase64 !== "string" ||
        !/^image\/(png|jpeg|webp)$/.test(asset.mimeType)
      )
        fail("INVALID_ASSET");
      const bytes = Buffer.from(asset.dataBase64, "base64"),
        sha256 = hash(bytes);
      if (
        asset.resourceId !== "asset-" + sha256 ||
        asset.sha256 !== sha256 ||
        asset.byteLength !== bytes.length
      )
        fail("ASSET_DIGEST_MISMATCH");
      await this.immutable(
        path.join(this.root, "assets", sha256 + ".json"),
        Buffer.from(
          JSON.stringify({
            resourceId: asset.resourceId,
            mimeType: asset.mimeType,
            sha256,
            byteLength: bytes.length,
            dataBase64: bytes.toString("base64"),
          }),
        ),
      );
    }
  }
  async requireAssets(doc) {
    for (const id of doc.assetReferences) {
      const bytes = await this.readOptional(
        path.join(this.root, "assets", id.slice(6) + ".json"),
      );
      if (!bytes) fail("MISSING_ASSET", id);
      const asset = JSON.parse(bytes.toString("utf8"));
      if (
        asset.resourceId !== id ||
        hash(Buffer.from(asset.dataBase64, "base64")) !== id.slice(6)
      )
        fail("ASSET_INTEGRITY_FAILED");
    }
  }
  list() {
    return this.enqueue(async () => ({
      ok: true,
      index: await this.readIndex(),
    }));
  }
  load(saveId) {
    return this.enqueue(async () => ({
      ok: true,
      document: await this.readDocument(await this.readIndex(), saveId),
    }));
  }
  importPreview(preview, { activate = false } = {}) {
    // Snapshot at acceptance, before the caller can mutate the message payload.
    let input;
    try {
      input = clone(preview);
    } catch (error) {
      return Promise.resolve({
        ok: false,
        code: "INVALID_IMPORT",
        message: error.message,
      });
    }
    return this.enqueue(async () => {
      this.schema.safeTree(input);
      if (
        typeof input.sourceText !== "string" ||
        Buffer.byteLength(input.sourceText) > MAX_BYTES ||
        hash(input.sourceText) !== input.sourceDigest
      )
        fail("SOURCE_DIGEST_MISMATCH");
      if (!Array.isArray(input.documents) || !input.documents.length)
        fail("INVALID_IMPORT");
      const docs = input.documents.map((d) => this.schema.validateV2(d));
      if (new Set(docs.map((d) => d.saveId)).size !== docs.length)
        fail("DUPLICATE_SAVE_ID");
      const index = await this.readIndex();
      if (Object.hasOwn(index.imports, input.sourceDigest))
        return {
          ok: true,
          idempotent: true,
          saveIds: index.imports[input.sourceDigest].saveIds,
        };
      for (const doc of docs)
        if ([...index.entries, ...(index.trashedEntries || [])].some((e) => e.saveId === doc.saveId))
          fail("SAVE_ALREADY_EXISTS");
      await this.stageAssets(input.assets || []);
      for (const doc of docs) {
        await this.requireAssets(doc);
        index.entries.push(await this.stageDocument(doc));
      }
      await this.immutable(
        path.join(this.root, "sources", input.sourceDigest + ".json"),
        Buffer.from(input.sourceText),
      );
      index.imports[input.sourceDigest] = {
        saveIds: docs.map((d) => d.saveId),
        createdAt: new Date().toISOString(),
      };
      if (activate && index.activeSaveId !== docs[0].saveId) {
        index.activeSaveId = docs[0].saveId;
        index.generation++;
      }
      index.revision++;
      await this.publish(index);
      return {
        ok: true,
        idempotent: false,
        index,
        saveIds: docs.map((d) => d.saveId),
      };
    });
  }
  commit(
    saveId,
    expectedRevision,
    document,
    { expectedGeneration, assets = [] } = {},
  ) {
    let snapshot;
    try {
      snapshot = clone({ document, assets });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        code: "INVALID_SAVE",
        message: error.message,
      });
    }
    return this.enqueue(async () => {
      const index = await this.readIndex();
      if (
        expectedGeneration !== undefined &&
        index.generation !== expectedGeneration
      )
        fail("GENERATION_CONFLICT");
      const old = await this.readDocument(index, saveId);
      if (old.revision !== expectedRevision) fail("REVISION_CONFLICT");
      if (
        snapshot.document.saveId !== saveId ||
        snapshot.document.revision !== expectedRevision
      )
        fail("INVALID_REVISION");
      const doc = this.schema.validateV2({
        ...snapshot.document,
        revision: expectedRevision + 1,
        updatedAt: new Date().toISOString(),
      });
      await this.stageAssets(snapshot.assets);
      await this.requireAssets(doc);
      const entry = await this.stageDocument(doc);
      index.entries = index.entries.map((e) =>
        e.saveId === saveId ? entry : e,
      );
      index.revision++;
      await this.publish(index);
      return { ok: true, document: doc, index };
    });
  }
  switchActive(saveId, { expectedGeneration } = {}) {
    return this.enqueue(async () => {
      const index = await this.readIndex();
      if (
        expectedGeneration !== undefined &&
        index.generation !== expectedGeneration
      )
        fail("GENERATION_CONFLICT");
      const doc = await this.readDocument(index, saveId);
      if (index.activeSaveId !== saveId) {
        index.activeSaveId = saveId;
        index.generation++;
        index.revision++;
        await this.publish(index);
      }
      return { ok: true, index, document: doc };
    });
  }
  setTrashed(saveId, trashed, {expectedGeneration, expectedRevision} = {}) {
    return this.enqueue(async () => {
      if (typeof trashed !== "boolean") fail("INVALID_TRASH_ACTION");
      const index = await this.readIndex();
      if (index.generation !== expectedGeneration) fail("GENERATION_CONFLICT");
      if (index.activeSaveId === saveId) fail("ACTIVE_SAVE");
      const from = trashed ? index.entries : (index.trashedEntries || []), target = from.find(e => e.saveId === saveId);
      if (!target) fail("SAVE_NOT_FOUND");
      if (target.revision !== expectedRevision) fail("REVISION_CONFLICT");
      const document = await this.readDocument({...index,entries:from},saveId);
      await this.requireAssets(document);
      index.trashedEntries ||= [];
      if (trashed) { index.entries = index.entries.filter(e => e.saveId !== saveId); index.trashedEntries.push({...target,trashedAt:new Date().toISOString()}); }
      else { index.trashedEntries = index.trashedEntries.filter(e => e.saveId !== saveId); const restored={...target};delete restored.trashedAt;index.entries.push(restored); }
      index.revision++;await this.publish(index);return {ok:true,index};
    });
  }
  getSource(digest) {
    return this.enqueue(async () => {
      if (!digestId(digest)) fail("INVALID_DIGEST");
      const index = await this.readIndex();
      if (!Object.hasOwn(index.imports, digest)) return null;
      const bytes = await fs.readFile(
        path.join(this.root, "sources", digest + ".json"),
      );
      if (hash(bytes) !== digest) fail("SOURCE_INTEGRITY_FAILED");
      return { sourceDigest: digest, sourceText: bytes.toString("utf8") };
    });
  }
  getAsset(id) {
    return this.enqueue(async () => {
      if (typeof id !== "string" || !/^asset-[a-f0-9]{64}$/.test(id))
        fail("INVALID_ASSET_ID");
      // Only published documents authorize asset reads; orphan staging is private.
      const index = await this.readIndex();
      let allowed = false;
      for (const e of index.entries) {
        if (
          (await this.readDocument(index, e.saveId)).assetReferences.includes(
            id,
          )
        ) {
          allowed = true;
          break;
        }
      }
      if (!allowed) return null;
      const bytes = await fs.readFile(
        path.join(this.root, "assets", id.slice(6) + ".json"),
      );
      const asset = JSON.parse(bytes.toString("utf8"));
      if (hash(Buffer.from(asset.dataBase64, "base64")) !== id.slice(6))
        fail("ASSET_INTEGRITY_FAILED");
      return asset;
    });
  }
  async readPreferences() {
    const bytes = await this.readOptional(
      path.join(this.root, "preferences.json"),
    );
    const prefs = bytes
      ? JSON.parse(bytes.toString("utf8"))
      : { schemaVersion: 1, revision: 0, values: {} };
    this.schema.safeTree(prefs);
    if (
      prefs.schemaVersion !== 1 ||
      !Number.isSafeInteger(prefs.revision) ||
      prefs.revision < 0 ||
      !prefs.values ||
      typeof prefs.values !== "object" ||
      Array.isArray(prefs.values)
    )
      fail("INVALID_PREFERENCES");
    return prefs;
  }
  loadPreferences() {
    return this.enqueue(async () => ({
      ok: true,
      preferences: await this.readPreferences(),
    }));
  }
  savePreferences(values, { expectedRevision } = {}) {
    let snapshot;
    try {
      snapshot = clone(values);
    } catch (error) {
      return Promise.resolve({
        ok: false,
        code: "INVALID_PREFERENCES",
        message: error.message,
      });
    }
    return this.enqueue(async () => {
      this.schema.safeTree(snapshot);
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
        fail("INVALID_PREFERENCES");
      const old = await this.readPreferences();
      if (expectedRevision !== undefined && old.revision !== expectedRevision)
        fail("REVISION_CONFLICT");
      const preferences = {
        schemaVersion: 1,
        revision: old.revision + 1,
        values: snapshot,
      };
      await this.atomicWrite(
        path.join(this.root, "preferences.json"),
        Buffer.from(JSON.stringify(preferences)),
      );
      return { ok: true, preferences };
    });
  }
}
module.exports = { SaveVault };
