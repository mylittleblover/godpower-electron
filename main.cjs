"use strict";
const {
  app,
  Menu,
  protocol,
  session,
  globalShortcut,
  Tray,
  nativeImage,
} = require("electron");
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
let windows, tray;
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
      // Use the bundled application icon, never a remote resource.
      const traySupported =
        process.platform !== "linux" ||
        !!process.env.DISPLAY ||
        !!process.env.WAYLAND_DISPLAY;
      if (traySupported) {
        const trayImage = nativeImage.createFromPath(
          require("node:path").join(__dirname, "build/icon.ico"),
        );
        tray = new Tray(
          trayImage.isEmpty()
            ? nativeImage.createFromDataURL(
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
              )
            : trayImage,
        );
        tray.setToolTip("上帝的力量 · 课堂后台运行");
        tray.setContextMenu(
          Menu.buildFromTemplate([
            { label: "显示主窗口", click: () => windows.showMain() },
            { label: "点名悬浮图标", click: () => windows.openPicker() },
            { type: "separator" },
            { label: "彻底退出", click: () => app.quit() },
          ]),
        );
        tray.on("double-click", () => windows.showMain());
        windows.onThemeChange = (brand) => {
          const icon = nativeImage.createFromPath(require("node:path").join(__dirname, brand.icon));
          if (!icon.isEmpty()) tray.setImage(icon);
          tray.setToolTip(`${brand.title} · 课堂后台运行`);
        };
        windows.onThemeChange(require("./desktop/theme.cjs").branding(windows.broker.snapshot?.theme));
      }
      app.on("activate", () => windows.showMain());
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
  app.on("window-all-closed", () => {
    if (windows?.quitting) app.quit();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
