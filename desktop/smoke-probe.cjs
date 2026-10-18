const { app } = require("electron");
async function runSmokeProbe(window, resultPath) {
  const firstLoad = await window.webContents.executeJavaScript(
    `(async () => {
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
  })()`,
    true,
  );
  const reloaded = new Promise((resolve) =>
    window.webContents.once("did-finish-load", resolve),
  );
  await window.webContents.reload();
  await reloaded;
  const secondLoad = await window.webContents.executeJavaScript(
    `(async () => {
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
  })()`,
    true,
  );
  require("node:fs").writeFileSync(
    resultPath,
    JSON.stringify(
      {
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
      },
      null,
      2,
    ),
  );
  app.quit();
}

module.exports = { runSmokeProbe };
