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
    onExecute: (fn) => listen("gp:execute", fn),
    onUnlockRequest: (fn) => listen("gp:unlock-request", fn),
    onShellState: (fn) => listen("gp:shell", fn),
    publish: (snapshot) => ipcRenderer.send("gp:publish", snapshot),
    reply: (value) => ipcRenderer.send("gp:reply", value),
    ready: () => ipcRenderer.send("gp:ready"),
    showScore: (value) => ipcRenderer.send("gp:score-effect", value),
    publishDialogs: (list) => ipcRenderer.send("gp:dialogs", list),
    onDialogEvent: (fn) => listen("gp:dialog-event", fn),
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
if (role === "window")
  Object.assign(base, {
    onDialogState: (fn) => listen("gp:dialog-state", fn),
    onDialogLeave: (fn) => listen("gp:dialog-leave", fn),
    dialogReady: () => ipcRenderer.invoke("gp:dialog-ready"),
    dialogEvent: (value) => ipcRenderer.invoke("gp:dialog-event", value),
  });
if (role === "effect")
  Object.assign(base, {
    onReveal: (fn) => listen("gp:reveal", fn),
    ready: () => ipcRenderer.send("gp:effect-ready"),
    finish: (id) => ipcRenderer.send("gp:effect-finish", { id }),
    interactive: (id, value) =>
      ipcRenderer.send("gp:effect-interactive", { id, value }),
  });
contextBridge.exposeInMainWorld("godpowerDesktop", Object.freeze(base));
