"use strict";
const { app, Menu, protocol, session, globalShortcut } = require("electron");
const { Windows } = require("./desktop/windows.cjs");
const { verifyHtml, installProtocol } = require("./desktop/protocol.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "classroom",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let windows;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => windows?.showMain());
  app
    .whenReady()
    .then(async () => {
      verifyHtml(__dirname);
      installProtocol(protocol, __dirname);
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
        (_details, callback) => callback({ cancel: true }),
      );
      windows = new Windows(__dirname);
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "课堂",
            submenu: [
              {
                label: "打开点名悬浮窗",
                accelerator: "Control+Shift+P",
                click: () => windows.openPicker(),
              },
              { label: "显示主窗口", click: () => windows.showMain() },
              { label: "跳过全屏演出", click: () => windows.closeEffect() },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          {
            label: "视图",
            submenu: [
              { role: "reload" },
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
              { role: "togglefullscreen" },
              ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
            ],
          },
        ]),
      );
      windows.shortcutAvailable = globalShortcut.register(
        "Control+Shift+P",
        () => windows.openPicker(),
      );
      const main = windows.createMain();
      if (!app.isPackaged) {
        const smoke = process.argv.find((a) => a.startsWith("--smoke-test="));
        const test = process.argv.find((a) => a.startsWith("--desktop-test="));
        if (smoke || test) {
          await new Promise((r) => main.webContents.once("did-finish-load", r));
          if (smoke)
            await require("./desktop/smoke-probe.cjs").runSmokeProbe(
              main,
              smoke.slice(13),
            );
          else
            await require("./desktop/test-probe.cjs").run(
              windows,
              test.slice(15),
            );
        }
      }
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
