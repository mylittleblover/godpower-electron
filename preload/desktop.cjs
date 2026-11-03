"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const role = process.argv.find((a) => a.startsWith("--gp-role="))?.slice(10);
const listen = (channel, fn) => {
  if (typeof fn !== "function") throw Error("Callback required");
  const handler = (_event, value) => fn(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
const base = { role };
if (role === "main")
  Object.assign(base, {
    onSaveFlush: (fn) => listen("gp:save-flush",fn),
    onSaveFlushCancel: (fn) => listen("gp:save-flush-cancel",fn),
    saveFlushReply: (message) => ipcRenderer.send("gp:save-flush-reply",message),
    onExecute: (fn) => listen("gp:execute", fn),
    onUnlockRequest: (fn) => listen("gp:unlock-request", fn),
    onShellState: (fn) => listen("gp:shell", fn),
    publish: (snapshot) => ipcRenderer.send("gp:publish", snapshot),
    reply: (value) => ipcRenderer.send("gp:reply", value),
    ready: () => ipcRenderer.send("gp:ready"),
    showScore: (value) => ipcRenderer.send("gp:score-effect", value),
    showItemFx: (value) => ipcRenderer.send("gp:item-effect", value),
    saveVault: Object.freeze({
      list: () => ipcRenderer.invoke("gp:save-vault", "list", []),
      load: (id) => ipcRenderer.invoke("gp:save-vault", "load", [id]),
      importPreview: (preview, options = {}) => ipcRenderer.invoke("gp:save-vault", "importPreview", [preview, options]),
      commit: (id, revision, save, options = {}) => ipcRenderer.invoke("gp:save-vault", "commit", [id, revision, save, options]),
      switchActive: (id, options = {}) => ipcRenderer.invoke("gp:save-vault", "switchActive", [id, options]),
      getSource: (digest) => ipcRenderer.invoke("gp:save-vault", "getSource", [digest]),
      getAsset: (id) => ipcRenderer.invoke("gp:save-vault", "getAsset", [id]),
      loadPreferences: () => ipcRenderer.invoke("gp:save-vault", "loadPreferences", []),
      savePreferences: (values, options = {}) => ipcRenderer.invoke("gp:save-vault", "savePreferences", [values, options]),
    }),
    saveFileInfo: () => ipcRenderer.invoke("gp:save-file-info"),
    saveFileSource: () => ipcRenderer.invoke("gp:save-file-source"),
    saveFileRead: () => ipcRenderer.invoke("gp:save-file-read"),
    saveFileWrite: (payload) => ipcRenderer.invoke("gp:save-file-write", payload),
    saveFileChoose: () => ipcRenderer.invoke("gp:save-file-choose"),
    saveFileSet: (value) => ipcRenderer.invoke("gp:save-file-set", value),
    saveFileReset: () => ipcRenderer.invoke("gp:save-file-reset"),
    openPicker: () => ipcRenderer.invoke("gp:open-picker"),
  });
if (role === "picker") {
  let clientEpoch = null;
  let epoch = null,
    seq = 0;
  const prefix = `ui-${Date.now().toString(36)}`;
  ipcRenderer.on("gp:state", (_event, s) => {
    epoch = s.epoch;
    clientEpoch = s.clientEpoch;
  });
  Object.assign(base, {
    getState: async () => {
      const s = await ipcRenderer.invoke("gp:get-state");
      epoch = s.epoch;
      clientEpoch = s.clientEpoch;
      return s;
    },
    onState: (fn) => listen("gp:state", fn),
    command: (action, payload = {}) => {
      const n = ++seq;
      return ipcRenderer.invoke("gp:command", {
        id: `${prefix}-${n}`,
        seq: n,
        epoch,
        clientEpoch,
        action,
        payload,
      });
    },
    windowAction: (action, value) =>
      ipcRenderer.invoke("gp:window", { action, value }),
  });
}
if (role === "effect")
  Object.assign(base, {
    onReveal: (fn) => listen("gp:reveal", fn),
    ready: () => ipcRenderer.send("gp:effect-ready"),
    finish: (id) => ipcRenderer.send("gp:effect-finish", { id }),
    interactive: (id, value) =>
      ipcRenderer.send("gp:effect-interactive", { id, value }),
  });
contextBridge.exposeInMainWorld("godpowerDesktop", Object.freeze(base));
