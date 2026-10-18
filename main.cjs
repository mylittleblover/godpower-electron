const { app, BrowserWindow, Menu, protocol, session } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const APP_ORIGIN = "classroom://app";
const APP_URL = `${APP_ORIGIN}/index.html`;
const CONTENT_SECURITY_POLICY = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' data:",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join("; ");

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

let mainWindow;
let smokeState = null;

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "classroom:" && url.host === "app" && url.pathname === "/index.html";
  } catch {
    return false;
  }
}

function installApplicationMenu() {
  const template = [
    { role: "editMenu" },
    {
      label: "视图",
      submenu: [
        { role: "reload" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function writeSmokeResult(result) {
  if (!smokeState || smokeState.written) return;
  smokeState.written = true;
  try {
    require("node:fs").writeFileSync(smokeState.resultPath, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Unable to write smoke result:", error);
    app.exit(2);
  }
}

async function runSmokeProbe(window) {
  const firstLoad = await window.webContents.executeJavaScript(`(async () => {
    const keys = [...document.querySelectorAll('[data-view]')]
      .map((element) => element.dataset.view);
    const requiredViews = ['welcome', 'battle', 'history', 'archives', 'settings'];
    const visibleView = document.querySelector('#view-welcome');
    const errors = [];
    window.addEventListener('error', (event) => errors.push(event.message));
    window.localStorage.setItem('gp-electron-smoke', 'isolated-profile');
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('gp-electron-smoke', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('checks');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('checks', 'readwrite');
      transaction.objectStore('checks').put('isolated-profile', 'marker');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return {
      title: document.title,
      origin: location.origin,
      views: requiredViews.filter((view) => keys.includes(view)),
      hasWelcome: Boolean(visibleView),
      localStorage: localStorage.getItem('gp-electron-smoke'),
      indexedDB: typeof indexedDB !== 'undefined',
      errors
    };
  })()`, true);
  const reloaded = new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  await window.webContents.reload();
  await reloaded;
  const secondLoad = await window.webContents.executeJavaScript(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('gp-electron-smoke');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const marker = await new Promise((resolve, reject) => {
      const request = database.transaction('checks').objectStore('checks').get('marker');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      storage: localStorage.getItem('gp-electron-smoke'),
      indexedDB: marker,
      origin: location.origin
    };
  })()`, true);
  writeSmokeResult({
    status:
      firstLoad.views.length === 5 &&
      firstLoad.hasWelcome &&
      firstLoad.indexedDB &&
      secondLoad.storage === "isolated-profile" &&
      secondLoad.indexedDB === "isolated-profile" &&
      firstLoad.origin === secondLoad.origin
        ? "PASS"
        : "FAIL",
    firstLoad,
    secondLoad,
  });
  app.quit();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: "#f1f7f5",
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.on("console-message", (event) => {
    if (event.level >= 2) console.error(`[renderer] ${event.message}`);
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(APP_URL);
  if (smokeState) await runSmokeProbe(mainWindow);
}

const smokeArgument = process.argv.find((argument) => argument.startsWith("--smoke-test="));
if (smokeArgument) smokeState = { resultPath: smokeArgument.slice("--smoke-test=".length), written: false };

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    installApplicationMenu();
    const pagePath = path.join(__dirname, "resources", "index.html");
    protocol.handle("classroom", async (request) => {
      if (request.method !== "GET" || request.url !== APP_URL) {
        return new Response("Not found", { status: 404 });
      }
      const html = await readFile(pagePath);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": CONTENT_SECURITY_POLICY,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    });

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    await createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    console.error("Failed to start classroom app:", error);
    writeSmokeResult({ status: "FAIL", error: error.stack || String(error) });
    app.exit(1);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
