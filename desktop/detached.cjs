"use strict";
const { BrowserWindow, ipcMain } = require("electron");
const { randomUUID } = require("node:crypto");
const { authorize } = require("./contracts.cjs");
const URL = "classroom://window/index.html";
const IDS = new Set([
  "welcomeModal",
  "scoreModalBackdrop",
  "pwdModal",
  "memberSearchBackdrop",
  "settlementNameModal",
  "grandModalOverlay",
  "itemModalBackdrop",
  "handRaiseBackdrop",
  "aboutBackdrop",
  "batchImportModal",
  "themeDialogV21727",
  "quickPersonBackdropV218",
  "programConfirmV28",
]);
function detachedWindowOptions(item, webPreferences) {
  return {
    width: [
      "scoreModalBackdrop",
      "pwdModal",
      "settlementNameModal",
      "themeDialogV21727",
      "programConfirmV28",
    ].includes(item.id)
      ? 600
      : 1080,
    height: [
      "pwdModal",
      "settlementNameModal",
      "themeDialogV21727",
      "programConfirmV28",
    ].includes(item.id)
      ? 480
      : item.id === "scoreModalBackdrop"
        ? 640
        : 820,
    minWidth: 500,
    minHeight: 380,
    resizable: true,
    frame: false,
    show: false,
    backgroundColor: "#f1f7f5",
    title: item.title || "课堂工具",
    webPreferences,
  };
}
class DetachedWindows {
  constructor(owner) {
    this.owner = owner;
    this.entries = new Map();
    ipcMain.on("gp:dialogs", (event, list) => {
      if (
        owner.quitting ||
        !owner.authorized(event, "main") ||
        !Array.isArray(list) ||
        list.length > IDS.size
      )
        return;
      const wanted = new Set();
      for (const item of list) {
        if (
          !IDS.has(item.id) ||
          typeof item.html !== "string" ||
          item.html.length > 24000000 ||
          typeof item.css !== "string" ||
          item.css.length > 3000000
        )
          continue;
        wanted.add(item.id);
        let entry = this.entries.get(item.id);
        if (!entry) {
          const win = new BrowserWindow(
            detachedWindowOptions(item, owner.preferencesFor("window")),
          );
          entry = { win, id: item.id, session: randomUUID(), snapshot: null };
          this.entries.set(item.id, entry);
          const wc = win.webContents;
          wc.on("did-start-loading", () => {
            entry.session = randomUUID();
            if (entry.snapshot) entry.snapshot.session = entry.session;
          });
          wc.setWindowOpenHandler(() => ({ action: "deny" }));
          wc.on("will-navigate", (e, url) => {
            if (url !== URL) e.preventDefault();
          });
          wc.on("will-attach-webview", (e) => e.preventDefault());
          win.setMenuBarVisibility(false);
          wc.on("render-process-gone", () => win.destroy());
          win.on("close", (event) => {
            if (owner.quitting) return;
            event.preventDefault();
            this.send(entry, { type: "close" });
          });
          win.on("closed", () => {
            if (this.entries.get(item.id) === entry) {
              this.entries.delete(item.id);
              this.send(entry, { type: "close" });
            }
          });
          win.loadURL(URL).catch(() => {
            if (!win.isDestroyed()) win.destroy();
          });
        }
        entry.snapshot = { ...item, session: entry.session };
        if (!entry.win.webContents.isLoading())
          entry.win.webContents.send("gp:dialog-state", entry.snapshot);
      }
      for (const [id, entry] of this.entries)
        if (!wanted.has(id)) {
          this.entries.delete(id);
          entry.win.webContents.send("gp:dialog-leave");
          setTimeout(() => {
            if (!entry.win.isDestroyed()) entry.win.destroy();
          }, 320);
        }
    });
    ipcMain.handle("gp:dialog-ready", (event) => {
      const entry = this.find(event);
      if (!entry) throw Error("FORBIDDEN");
      entry.win.show();
      return entry.snapshot;
    });
    ipcMain.handle("gp:dialog-event", (event, message) => {
      const entry = this.find(event);
      if (!entry || message?.session !== entry.session)
        throw Error("STALE_WINDOW");
      if (
        ![
          "click",
          "input",
          "change",
          "keydown",
          "submit",
          "close",
          "files",
        ].includes(message.type)
      )
        throw Error("INVALID_EVENT");
      if (
        !["close", "input", "change", "files"].includes(message.type) &&
        message.version !== entry.snapshot?.version
      )
        return { ok: false, error: "STALE_PRESENTATION" };
      if (
        message.type !== "close" &&
        (!Number.isSafeInteger(message.token) || message.token < 1)
      )
        throw Error("INVALID_TARGET");
      if (
        message.value !== undefined &&
        (typeof message.value !== "string" || message.value.length > 1000000)
      )
        throw Error("INVALID_VALUE");
      if (
        message.type === "keydown" &&
        !["Enter", "Escape"].includes(message.key)
      )
        throw Error("INVALID_KEY");
      if (
        message.type === "files" &&
        (!Array.isArray(message.files) ||
          message.files.length > 16 ||
          message.files.some(
            (f) =>
              typeof f.name !== "string" ||
              f.name.length > 500 ||
              !(f.bytes instanceof Uint8Array) ||
              f.bytes.length > 64000000,
          ))
      )
        throw Error("INVALID_FILES");
      this.send(entry, message);
      return { ok: true };
    });
  }
  find(event) {
    return [...this.entries.values()].find((e) => authorize(event, e.win, URL));
  }
  send(entry, message) {
    const main = this.owner.main;
    if (main && !main.isDestroyed())
      main.webContents.send("gp:dialog-event", { ...message, id: entry.id });
  }
  closeAll() {
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) entry.win.destroy();
  }
}
module.exports = { DetachedWindows, IDS, detachedWindowOptions };
