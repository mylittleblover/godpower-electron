"use strict";
const vm = require("node:vm");
const { verifyHtml, verifySharedAsset } = require("./protocol.cjs");
function loadSaveSchema(root, { verifiedBuild = null } = {}) {
  const info = verifiedBuild || verifyHtml(root);
  if (!info.sharedAssets?.["save-schema.js"])
    throw Error("SHARED_SAVE_SCHEMA_MISSING");
  const { source } = verifySharedAsset(root, "save-schema.js", info);
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  vm.runInContext(
    source,
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
  setTrashed: 3,
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
