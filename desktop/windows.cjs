"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
} = require("electron");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  URLS,
  authorize,
  sanitizeSnapshot,
  sanitizeItemFx,
  pickEffectStyle,
} = require("./contracts.cjs");
const { branding } = require("./theme.cjs");
const { Broker } = require("./broker.cjs");
const PickerDrag = require("./picker-drag.cjs");
const { EscapeLease } = require("./escape-lease.cjs");
const {
  WindowState,
  visibleBounds,
  iconBounds,
  menuBounds,
} = require("./window-state.cjs");
const { SaveFile, normalizeTarget } = require("./save-file.cjs");
class Windows {
  constructor(root) {
    this.root = root;
    this.main = null;
    this.picker = null;
    this.effect = null;
    this.revision = 0;
    this.lastReveal = null;
    this.quitting = false;
    this.escape = new EscapeLease(globalShortcut);
    this.crashed = false;
    this.preferences = new WindowState(
      path.join(app.getPath("userData"), "desktop-windows-v1.json"),
    );
    this.saveFile = new SaveFile({
      root: path.join(app.getPath("documents"), "GodPower"),
    });
    if (this.preferences.value.saveFile)
      try {
        this.saveFile.choose(this.preferences.value.saveFile);
      } catch (error) {
        console.warn("Ignoring unusable saved path:", error.message);
      }
    this.broker = new Broker(
      (message) => this.main.webContents.send("gp:execute", message),
      { onChange: () => this.broadcast() },
    );
    this.pickerView = "icon";
    this.installIPC();
    app.on("before-quit", (event) => {
      this.quitting = true;
      if (this.saveFile.pendingWrites > 0) {
        event.preventDefault();
        if (!this.saveQuitPending) {
          this.saveQuitPending = true;
          this.saveFile.whenIdle().then(() => {
            this.saveQuitPending = false;
            app.quit();
          }).catch((error) => {
            this.saveQuitPending = false;
            this.quitting = false;
            console.error("等待课堂存档完成失败", error);
          });
        }
        return;
      }
      this.savePicker();
      this.closeEffect();
    });
    for (const name of [
      "display-added",
      "display-removed",
      "display-metrics-changed",
    ])
      screen.on(name, () => {
        if (this.picker && !this.picker.isDestroyed())
          this.picker.setBounds(
            (this.pickerCollapsed ? iconBounds : visibleBounds)(
              this.picker.getBounds(),
              screen.getAllDisplays(),
              null,
            ),
          );
        this.closeEffect();
        this.broadcast();
      });
  }
  preferencesFor(role) {
    return {
      preload: path.join(this.root, "preload/desktop.cjs"),
      additionalArguments: [`--gp-role=${role}`],
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      nodeIntegration: false,
      allowRunningInsecureContent: false,
      spellcheck: false,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    };
  }
  secure(win, role) {
    const wc = win.webContents;
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const name of ["will-navigate", "will-redirect"])
      wc.on(name, (event, url) => {
        if (url !== URLS[role]) event.preventDefault();
      });
    wc.on("will-attach-webview", (e) => e.preventDefault());
    wc.on("console-message", (event) => {
      if (event.level >= 3) console.error(`[${role}] ${event.message}`);
    });
  }
  createMain() {
    this.main = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 1024,
      minHeight: 720,
      show: false,
      backgroundColor: "#f1f7f5",
      title: "上帝的力量",
      icon: path.join(this.root, branding("classic").icon),
      webPreferences: this.preferencesFor("main"),
    });
    this.secure(this.main, "main");
    this.main.webContents.on("did-start-loading", () => {
      this.lastReveal = null;
      this.closeEffect();
      this.broker.reset();
    });
    this.main.webContents.on("render-process-gone", () => {
      this.crashed = true;
      this.closeEffect();
      this.broker.reset();
    });
    this.main.once("ready-to-show", () => {
      this.main.show();
      this.openPicker();
    });
    this.main.on("close", (event) => {
      if (!this.quitting) {
        event.preventDefault();
        this.main.hide();
        this.openPicker();
      }
    });
    this.main.on("closed", () => {
      this.main = null;
      if (!this.quitting) app.quit();
    });
    this.main.loadURL(URLS.main).catch((error) => {
      console.error("Main classroom load failed:", error.message);
      this.broker.reset();
    });
    return this.main;
  }
  showMain() {
    if (!this.main) return;
    if (this.crashed) {
      this.crashed = false;
      this.main.reload();
    }
    if (this.main.isMinimized()) this.main.restore();
    this.main.show();
    this.main.focus();
  }
  openPicker({ expanded = false } = {}) {
    if (this.quitting) return;
    if (this.pickerClosing) {
      this.reopenPicker = true;
      return;
    }
    if (this.picker && !this.picker.isDestroyed()) {
      this.picker.show();
      this.ensurePickerLevel(true);
      if (expanded) this.setPickerExpanded(true);
      this.picker.focus();
      return;
    }
    this.pickerCollapsed = true;
    this.pickerView = expanded ? "picker" : "icon";
    const bounds = iconBounds(
      this.preferences.value.iconPosition,
      screen.getAllDisplays(),
      null,
    );
    const win = new BrowserWindow({
      ...bounds,
      minWidth: 72,
      minHeight: 72,
      frame: false,
      resizable: false,
      transparent: true,
      show: false,
      backgroundColor: "#00000000",
      alwaysOnTop: this.preferences.value.alwaysOnTop,
      // The launcher belongs to the classroom, not to the taskbar or Alt+Tab.
      skipTaskbar: true,
      title: `课堂点名 · ${branding(this.broker.snapshot?.theme).title}`,
      icon: path.join(this.root, branding(this.broker.snapshot?.theme).icon),
      webPreferences: this.preferencesFor("picker"),
    });
    this.picker = win;
    this.secure(win, "picker");
    let blurTimer = null,
      pickerHadFocus = win.isFocused();
    win.on("focus", () => {
      pickerHadFocus = true;
    });
    win.on("blur", () => {
      if (!pickerHadFocus) return;
      pickerHadFocus = false;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(async () => {
        if (
          this.picker === win &&
          !win.isDestroyed() &&
          !this.quitting &&
          !this.pickerCollapsed &&
          !this.choosing &&
          !win.isFocused()
        ) {
          // Windows touch keyboards can take native focus while the text field
          // remains the renderer's active control. Do not collapse its owner.
          const editing = await win.webContents.executeJavaScript(
            `!!document.activeElement?.matches('input:not([type=button]):not([type=checkbox]):not([type=range]),textarea,[contenteditable=true]')`,
          ).catch(() => false);
          if (!editing && this.picker === win && !win.isDestroyed() && !win.isFocused())
            this.setPickerExpanded(false);
        }
      }, 90);
    });
    win.webContents.on("render-process-gone", () => win.destroy());
    this.ensurePickerLevel();
    win.once("ready-to-show", () => {
      win.show();
      this.broadcast();
    });
    const save = () => {
      clearTimeout(this.boundsTimer);
      this.boundsTimer = setTimeout(() => this.savePicker(), 180);
    };
    win.on("move", save);
    win.on("resize", save);
    win.on("close", () => {
      this.pickerClosing = true;
      this.savePicker();
    });
    this.pickerSession = randomUUID();
    let client = `${win.webContents.id}:${this.pickerSession}`;
    win.webContents.on("did-start-loading", () => {
      this.broker.dropClient(client);
      this.pickerSession = randomUUID();
      client = `${win.webContents.id}:${this.pickerSession}`;
      this.broadcast();
    });
    win.on("closed", () => {
      this.iconDrag = null;
      clearTimeout(blurTimer);
      clearTimeout(this.boundsTimer);
      clearTimeout(this.levelTimer);
      this.iconDrag = null;
      this.broker.dropClient(client);
      if (this.picker === win) this.picker = null;
      this.pickerClosing = false;
      if (this.reopenPicker && !this.quitting) {
        this.reopenPicker = false;
        this.openPicker();
      }
    });
    win.loadURL(URLS.picker).catch((error) => {
      if (!win.isDestroyed()) {
        console.error("Picker load failed:", error.message);
        win.destroy();
      }
    });
  }
  savePicker() {
    if (this.picker && !this.picker.isDestroyed())
      this.preferences.update(
        this.pickerCollapsed
          ? { iconPosition: this.picker.getBounds() }
          : { pickerBounds: this.picker.getBounds() },
      );
  }
  /* Outrank ordinary always-on-top players (video, PPT) without stealing focus. */
  ensurePickerLevel(reassert = false) {
    const win = this.picker;
    if (!win || win.isDestroyed()) return;
    if (!this.preferences.value.alwaysOnTop) {
      win.setAlwaysOnTop(false);
      return;
    }
    win.setAlwaysOnTop(true, "screen-saver", 1);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setSkipTaskbar(true);
    if (reassert && this.pickerCollapsed) {
      win.setAlwaysOnTop(false);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.moveTop();
    }
  }
  /* Exclusive fullscreen video and PPT rebuild the topmost band when they enter
     or leave their mode, so the launcher re-asserts its level around that. */
  reassertPickerLevel() {
    this.ensurePickerLevel(true);
    clearTimeout(this.levelTimer);
    for (const delay of [1200, 4200])
      this.levelTimer = setTimeout(() => this.ensurePickerLevel(true), delay);
  }
  setPickerExpanded(expanded) {
    if (!this.picker || this.picker.isDestroyed()) return;
    const anchor = this.picker.getBounds();
    this.savePicker();
    this.pickerCollapsed = !expanded;
    this.pickerView = expanded
      ? this.pickerView === "hand"
        ? "hand"
        : "picker"
      : "icon";
    this.choosing = false;
    this.picker.setMinimumSize(expanded ? 360 : 72, expanded ? 520 : 72);
    this.picker.setResizable(expanded);
    this.picker.setBounds(
      expanded
        ? visibleBounds(
            {...(this.preferences.value.pickerBounds || {width:480,height:760}),x:anchor.x,y:anchor.y},
            screen.getAllDisplays(),
            null,
          )
        : iconBounds(
            this.preferences.value.iconPosition,
            screen.getAllDisplays(),
          ),
    );
    this.ensurePickerLevel(true);
    this.broadcast();
  }
  /* The collapsed icon is a launcher menu: picker or hand, no second taskbar window. */
  showLauncher() {
    if (!this.picker || this.picker.isDestroyed()) return;
    this.pickerView = "launcher";
    this.choosing = true;
    this.pickerCollapsed = true;
    this.savePicker();
    this.picker.setMinimumSize(280, 180);
    this.picker.setResizable(false);
    // The menu opens in the icon's own place and stays inside the work area.
    const anchor = this.iconBoundsNow();
    this.picker.setBounds(
      menuBounds(
        { x: anchor.x, y: anchor.y },
        screen.getAllDisplays(),
      ),
    );
    this.ensurePickerLevel(true);
    this.broadcast();
  }
  iconBoundsNow() {
    return iconBounds(
      this.preferences.value.iconPosition,
      screen.getAllDisplays(),
    );
  }
  hideLauncher() {
    if (!this.picker || this.picker.isDestroyed()) return;
    this.choosing = false;
    this.pickerView = "icon";
    this.pickerCollapsed = true;
    this.picker.setMinimumSize(72, 72);
    this.picker.setBounds(this.iconBoundsNow());
    this.ensurePickerLevel();
    this.broadcast();
  }
  state() {
    const displays = screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `显示器 ${d.id}`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
    }));
    return {
      revision: this.revision,
      epoch: this.broker.epoch,
      clientEpoch: this.pickerSession,
      ready: this.broker.ready,
      snapshot: this.broker.snapshot,
      shell: {
        ...this.preferences.value,
        collapsed: !!this.pickerCollapsed,
        view: this.pickerView || "icon",
        handGroupId: this.handGroupId ?? null,
        displayId: this.targetDisplay().id,
        displays,
        effectActive: !!this.effect,
        shortcutAvailable: !!this.shortcutAvailable,
      },
    };
  }
  broadcast() {
    this.updateBranding();
    this.revision++;
    if (this.picker && !this.picker.isDestroyed())
      this.picker.webContents.send("gp:state", this.state());
    if (this.main && !this.main.isDestroyed() && !this.crashed && !this.main.webContents.isDestroyed())
      this.main.webContents.send("gp:shell", this.preferences.value);
  }
  updateBranding() {
    const theme = this.broker.snapshot?.theme === "marx" ? "marx" : "classic";
    if (this.appliedTheme === theme) return;
    this.appliedTheme = theme;
    const brand = branding(theme);
    for (const [win, prefix] of [[this.main, ""], [this.picker, "课堂点名 · "]]) {
      if (win && !win.isDestroyed()) {
        win.setTitle(prefix + brand.title);
        win.setIcon(path.join(this.root, brand.icon));
      }
    }
    if (this.main && !this.main.isDestroyed()) this.main.setBackgroundColor(brand.background);
    this.onThemeChange?.(brand);
  }
  targetDisplay() {
    return (
      screen
        .getAllDisplays()
        .find((d) => d.id === this.preferences.value.displayId) ||
      screen.getPrimaryDisplay()
    );
  }
  present(snapshot) {
    if (this.quitting) return;
    if (
      !snapshot.result ||
      snapshot.phase !== "revealed" ||
      snapshot.result.id === this.lastReveal
    )
      return;
    if (snapshot.result.mode !== "score") this.lastReveal = snapshot.result.id;
    if (!this.preferences.value.effectsEnabled || !snapshot.effects.enabled)
      return;
    this.closeEffect();
    const display = this.targetDisplay(),
      id = snapshot.result.id;
    const win = new BrowserWindow({
      ...display.bounds,
      transparent: true,
      frame: false,
      show: false,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      enableLargerThanScreen: true,
      webPreferences: this.preferencesFor("effect"),
    });
    this.effect = win;
    win.webContents.on("render-process-gone", () => {
      if (this.effect === win) this.closeEffect();
    });
    this.effectPayload = {
      id,
      theme: snapshot.theme === "marx" ? "marx" : "classic",
      result: snapshot.result,
      // Each reveal picks one of the ten presentations; an explicit choice wins.
      effects: { ...snapshot.effects, style: pickEffectStyle(snapshot.effects?.style) },
    };
    this.secure(win, "effect");
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on("closed", () => {
      if (this.effect === win) {
        this.effect = null;
        this.effectPayload = null;
        clearTimeout(this.effectTimeout);
        this.escape.release();
        this.broadcast();
      }
    });
    this.effectTimeout = setTimeout(
      () => this.closeEffect(),
      snapshot.effects.duration + 6500,
    );
    win.loadURL(URLS.effect).catch((error) => {
      if (!win.isDestroyed()) {
        console.error("Effect load failed:", error.message);
        if (this.effect === win) this.closeEffect();
      }
    });
    this.broadcast();
  }
  closeEffect() {
    clearTimeout(this.effectTimeout);
    const win = this.effect;
    this.effect = null;
    this.effectPayload = null;
    this.escape.release();
    if (win && !win.isDestroyed()) win.destroy();
    this.broadcast();
  }
  /* The item cinematic is a second payload shape of the same full-screen
     window, so it inherits the verified topmost/escape/mouse behaviour. */
  presentItemFx(payload, effects) {
    if (this.quitting) return;
    if (!this.preferences.value.effectsEnabled) return;
    this.closeEffect();
    const display = this.targetDisplay();
    const win = new BrowserWindow({
      ...display.bounds,
      transparent: true,
      frame: false,
      show: false,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      enableLargerThanScreen: true,
      webPreferences: this.preferencesFor("effect"),
    });
    this.effect = win;
    win.webContents.on("render-process-gone", () => {
      if (this.effect === win) this.closeEffect();
    });
    this.effectPayload = {
      id: randomUUID(),
      theme: this.broker.snapshot?.theme === "marx" ? "marx" : "classic",
      kind: "item",
      item: payload,
      effects,
    };
    this.secure(win, "effect");
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on("closed", () => {
      if (this.effect === win) {
        this.effect = null;
        this.effectPayload = null;
        clearTimeout(this.effectTimeout);
        this.escape.release();
        this.broadcast();
      }
    });
    this.effectTimeout = setTimeout(
      () => this.closeEffect(),
      effects.duration + 6500,
    );
    win.loadURL(URLS.effect).catch((error) => {
      if (!win.isDestroyed()) {
        console.error("Item cinematic load failed:", error.message);
        if (this.effect === win) this.closeEffect();
      }
    });
    this.broadcast();
  }
  authorized(event, role) {
    return authorize(
      event,
      this[role === "effect" ? "effect" : role === "main" ? "main" : "picker"],
      URLS[role],
    );
  }
  installIPC() {
    const requireRole = (event, role) => {
      if (!this.authorized(event, role)) throw Error("FORBIDDEN");
    };
    ipcMain.on("gp:score-effect", (event, value) => {
      if (
        !this.authorized(event, "main") ||
        typeof value?.name !== "string" ||
        value.name.length > 500 ||
        !Number.isSafeInteger(value.delta) ||
        !value.delta
      )
        return;
      const effects = {
        enabled: true,
        style: pickEffectStyle(value.effects?.style),
        duration: [1200, 1800, 2600, 3600].includes(value.effects?.duration)
          ? value.effects.duration
          : 1800,
      };
      this.present({
        theme: this.broker.snapshot?.theme,
        phase: "revealed",
        effects,
        result: {
          id: randomUUID(),
          mode: "score",
          name: (value.delta > 0 ? "+" : "−") + Math.abs(value.delta),
          groupName: value.name,
          number: null,
          groupNo: 0,
          color: value.delta > 0 ? "#15916a" : "#da4f51",
        },
      });
    });
    ipcMain.on("gp:ready", (event) => {
      if (!this.authorized(event, "main")) return;
      this.broker.ready = true;
      this.broadcast();
    });
    ipcMain.on("gp:publish", (event, value) => {
      if (!this.authorized(event, "main")) return;
      try {
        this.broker.snapshot = sanitizeSnapshot(value);
        if (this.broker.ready) this.present(this.broker.snapshot);
        this.broadcast();
      } catch (error) {
        console.error("Rejected classroom snapshot:", error.message);
      }
    });
    ipcMain.on("gp:reply", (event, message) => {
      if (this.authorized(event, "main")) this.broker.reply(message);
    });
    ipcMain.handle("gp:save-file-info", async (event) => {
      requireRole(event, "main");
      await this.saveFile.whenIdle();
      return this.saveFile.info;
    });
    ipcMain.handle("gp:save-file-read", async (event) => {
      requireRole(event, "main");
      await this.saveFile.whenIdle();
      return this.saveFile.read();
    });
    ipcMain.handle("gp:save-file-write", (event, payload) => {
      requireRole(event, "main");
      if (payload == null || typeof payload !== "object" || Array.isArray(payload))
        return { ok: false, error: "INVALID_PAYLOAD" };
      return this.saveFile.write(payload);
    });
    ipcMain.handle("gp:save-file-choose", async (event) => {
      requireRole(event, "main");
      const win = this.main;
      if (!win || win.isDestroyed()) return { ok: false, error: "MAIN_UNAVAILABLE" };
      const { dialog } = require("electron");
      const current = this.saveFile.info;
      const picked = await dialog.showSaveDialog(win, {
        title: "选择课堂存档位置",
        defaultPath: current.path,
        buttonLabel: "使用此位置",
        filters: [{ name: "课堂存档", extensions: ["json"] }],
        properties: ["createDirectory", "showOverwriteConfirmation"],
      });
      if (picked.canceled || !picked.filePath) return { ok: false, canceled: true };
      try {
        await this.saveFile.whenIdle();
        const info = this.saveFile.choose(picked.filePath);
        this.preferences.update({ saveFile: info.path });
        this.broadcast();
        return { ok: true, info };
      } catch (error) {
        return { ok: false, error: String(error.message || error) };
      }
    });
    ipcMain.handle("gp:save-file-set", async (event, value) => {
      requireRole(event, "main");
      await this.saveFile.whenIdle();
      if (typeof value !== "string") return { ok: false, error: "INVALID_PATH" };
      try {
        const info = this.saveFile.choose(value);
        this.preferences.update({ saveFile: info.path });
        this.broadcast();
        return { ok: true, info };
      } catch (error) {
        return { ok: false, error: String(error.message || error) };
      }
    });
    ipcMain.handle("gp:save-file-reset", async (event) => {
      requireRole(event, "main");
      await this.saveFile.whenIdle();
      const info = this.saveFile.reset();
      this.preferences.update({ saveFile: null });
      this.broadcast();
      return { ok: true, info };
    });
    ipcMain.handle("gp:open-picker", (event) => {
      requireRole(event, "main");
      this.openPicker({ expanded: true });
      this.setPickerExpanded(true);
      return { ok: true };
    });
    ipcMain.handle("gp:get-state", (event) => {
      requireRole(event, "picker");
      return this.state();
    });
    ipcMain.handle("gp:command", (event, request) => {
      requireRole(event, "picker");
      if (request?.clientEpoch !== this.pickerSession)
        return { ok: false, error: "STALE_CLIENT" };
      return this.broker.command(
        request,
        `${event.sender.id}:${this.pickerSession}`,
      );
    });
    ipcMain.handle("gp:window", (event, message) => {
      requireRole(event, "picker");
      const { action, value } = message || {};
      if (action === "expand" || action === "collapse") {
        if (action === "expand" && value === "hand") this.pickerView = "hand";
        if (action === "expand" && value === "picker") this.pickerView = "picker";
        this.setPickerExpanded(action === "expand");
        return { ok: true };
      }
      if (action === "launcher") {
        this.showLauncher();
        return { ok: true };
      }
      if (action === "launcherClose") {
        this.hideLauncher();
        return { ok: true };
      }
      if (action === "dragStart" && this.pickerCollapsed) {
        this.iconDrag = {cursor:PickerDrag.point(value),bounds:this.picker.getBounds(),moved:false};
        return {ok:true};
      }
      if (action === "dragMove" || action === "dragEnd" || action === "dragCancel") {
        const drag=this.iconDrag;
        if(!drag)return {ok:false,error:"NO_DRAG"};
        if(value){
          const next=PickerDrag.move(drag,value);drag.moved=next.moved;
          if(next.moved)this.picker.setBounds(iconBounds(next,screen.getAllDisplays()));
        }
        if(action === "dragMove")return {ok:true};
        this.iconDrag=null;this.savePicker();
        if(action === "dragEnd"&&!drag.moved&&this.pickerCollapsed)this.showLauncher();
        return {ok:true};
      }
      if (action === "close") {
        this.picker.close();
        return { ok: true };
      }
      if (action === "minimize") {
        this.picker.minimize();
        return { ok: true };
      }
      if (action === "showMain") {
        this.showMain();
        return { ok: true };
      }
      if (action === "unlock") {
        if (!this.main || this.main.isDestroyed())
          return { ok: false, error: "MAIN_UNAVAILABLE" };
        this.showMain();
        this.main.webContents.send("gp:unlock-request");
        return { ok: true };
      }
      if (action === "skip") {
        this.closeEffect();
        return { ok: true };
      }
      if (action === "pin" && typeof value === "boolean") {
        const ok = this.preferences.update({ alwaysOnTop: value });
        this.ensurePickerLevel(true);
        this.broadcast();
        return { ok };
      }
      if (action === "effects" && typeof value === "boolean") {
        const ok = this.preferences.update({ effectsEnabled: value });
        if (!value) this.closeEffect();
        this.broadcast();
        return { ok };
      }
      if (
        action === "display" &&
        Number.isSafeInteger(value) &&
        screen.getAllDisplays().some((d) => d.id === value)
      ) {
        const ok = this.preferences.update({ displayId: value });
        this.broadcast();
        return { ok };
      }
      throw Error("INVALID_WINDOW_ACTION");
    });
    ipcMain.on("gp:item-effect", (event, value) => {
      if (!this.authorized(event, "main")) return;
      const safe = sanitizeItemFx(value);
      if (!safe) return;
      const effects = {
        enabled: true,
        style: pickEffectStyle(value.effects?.style),
        duration: [1200, 1800, 2600, 3600].includes(value.effects?.duration)
          ? value.effects.duration
          : 2600,
      };
      this.presentItemFx(safe, effects);
    });
    ipcMain.on("gp:effect-ready", (event) => {
      if (!this.authorized(event, "effect") || !this.effectPayload) return;
      this.effect.webContents.send("gp:reveal", this.effectPayload);
      this.effect.showInactive();
      this.escape.acquire(() => this.closeEffect());
    });
    ipcMain.on("gp:effect-finish", (event, msg) => {
      if (
        this.authorized(event, "effect") &&
        msg?.id === this.effectPayload?.id
      )
        this.closeEffect();
    });
    ipcMain.on("gp:effect-interactive", (event, msg) => {
      if (
        this.authorized(event, "effect") &&
        msg?.id === this.effectPayload?.id &&
        typeof msg.value === "boolean"
      )
        this.effect.setIgnoreMouseEvents(!msg.value, { forward: true });
    });
  }
}
module.exports = { Windows };
