"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { verifyHtml } = require("./protocol.cjs");
function loadSaveSchema(root) {
  const info = verifyHtml(root);
  if (!info.sharedAssets?.["save-schema.js"])
    throw Error("SHARED_SAVE_SCHEMA_MISSING");
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "resources/save-schema.js"), "utf8"),
    context,
    { timeout: 1000, filename: "save-schema.js" },
  );
  if (!context.SaveSchema?.validateV2)
    throw Error("SHARED_SAVE_SCHEMA_INVALID");
  return context.SaveSchema;
}
const arities = Object.freeze({
  list: 0,
  load: 1,
  importPreview: 2,
  commit: 4,
  switchActive: 2,
  getSource: 1,
  getAsset: 1,
  loadPreferences: 0,
  savePreferences: 2,
});
function dispatch(vault, action, args) {
  if (
    !Object.hasOwn(arities, action) ||
    !Array.isArray(args) ||
    args.length !== arities[action]
  )
    return Promise.resolve({ ok: false, code: "INVALID_SAVE_ACTION" });
  return vault[action](...args);
}
module.exports = { loadSaveSchema, dispatch };
