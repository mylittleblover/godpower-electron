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
const {validateHandCardRequest}=require("./hand-cards.cjs");
const PickerDrag = require("./picker-drag.cjs");
const { EscapeLease } = require("./escape-lease.cjs");
const {
  WindowState,
  visibleBounds,
  iconBounds,
  menuBounds,
} = require("./window-state.cjs");
const { SaveFile, normalizeTarget } = require("./save-file.cjs");
const { SaveVault } = require("./save-vault.cjs");
const { SaveFlush } = require("./save-flush.cjs");
const { loadSaveSchema, dispatch: dispatchSaveVault } = require("./save-vault-bridge.cjs");
const {skipRegion,containsCursor}=require('./effect-pointer.cjs');
class Windows {
  constructor(root) {
    this.root = root;
    this.main = null;
    this.picker = null;
    this.effect = null;
    this.revision = 0;
    this.lastReveal = null;
    this.pendingFeedback = null;
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
    this.saveFlush=new SaveFlush(message=>{
      if(!this.main||this.main.isDestroyed())throw Error("MAIN_UNAVAILABLE");
      this.main.webContents.send("gp:save-flush",message);
    });
    this.rendererQuitFlushed=false;this.rendererQuitPending=false;
    this.pickerView = "icon";
    this.installIPC();
    app.on("before-quit", (event) => {
      this.quitting = true;
      this.ai?.cancelAll();
      if(!this.rendererQuitFlushed&&this.main&&!this.main.isDestroyed()&&this.broker.ready){
        event.preventDefault();
        if(!this.rendererQuitPending){
          this.rendererQuitPending=true;
          this.saveFlush.request().then(result=>{
            this.rendererQuitPending=false;
            if(result.ok){this.rendererQuitFlushed=true;app.quit();}
            else {
              this.quitting=false;
              if(this.main&&!this.main.isDestroyed())this.main.webContents.send("gp:save-flush-cancel",result);
              this.showMain();console.error("退出前保存未完成",result.error);
            }
          });
        }
        return;
      }

      if (this.saveFile.pendingWrites > 0 || this.saveVault?.pendingWrites > 0) {
        event.preventDefault();
        if (!this.saveQuitPending) {
          this.saveQuitPending = true;
          const pending = this.saveVault?.pendingWrites > 0
            ? Promise.all([this.saveFile.whenIdle(), this.saveVault.whenIdle()])
            : this.saveFile.whenIdle();
          pending.then(() => {
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
      this.ai?.cancelAll();
      this.lastReveal = null;
      this.closeEffect();
      this.broker.reset();
    });
    this.main.webContents.on("render-process-gone", () => {
      this.ai?.cancelAll();
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
          !(this.effect && !this.effect.isDestroyed() && (this.nativeHandActive || this.effect.isFocused())) &&
          !win.isFocused()
        ) {
          // Windows touch keyboards can take native focus while the text field
          // remains the renderer's active control. Do not collapse its owner.
          const editing = await win.webContents.executeJavaScript(
            `!!document.activeElement?.matches('input:not([type=button]):not([type=checkbox]):not([type=range]),textarea,[contenteditable=true]')`,
          ).catch(() => false);
          if (!editing && this.picker === win && !win.isDestroyed() && !win.isFocused() &&
            !(this.effect && !this.effect.isDestroyed() && (this.nativeHandActive || this.effect.isFocused())))
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
  presentHandCard(snapshot, phase = snapshot?.hand?.phase) {
    const hand=snapshot?.hand,group=snapshot?.groups?.find(g=>g.id===hand?.groupId);
    if(!hand?.selectionId||!group)return;
    const id="hand-"+hand.selectionId;
    const payload={kind:"hand",id,saveContext:snapshot.saveContext,theme:snapshot.theme,hand:{...hand,phase},group,slots:snapshot.slots,effects:{enabled:true,duration:2600,style:"aurora"}};
    if(this.effectPayload?.kind==="hand"&&this.effect&&!this.effect.isDestroyed()) {
      const selectionChanged = this.effectPayload.id !== id;
      this.effectPayload=payload;
      if (selectionChanged) {
        clearTimeout(this.effectTimeout);
        this.effectTimeout = setTimeout(() => this.closeEffect(), 180000);
      }
      if(!this.effect.webContents.isLoading())this.effect.webContents.send("gp:reveal",payload);
      return;
    }
    const wasActive=this.nativeHandActive;
    this.present(payload);
    this.nativeHandActive=wasActive;
  }
  reconcileHandCard() {
    if(!this.nativeHandActive)return;
    const snapshot=this.broker.snapshot,hand=snapshot?.hand;
    if(!hand?.selectionId){this.nativeHandActive=false;if(this.effectPayload?.kind==="hand")this.closeEffect();return;}
    if(hand.rewardComplete&&hand.itemRewarded&&this.lastHandDraw!==hand.selectionId){
      this.lastHandDraw=hand.selectionId;
      if(!this.preferences.value.effectsEnabled){this.nativeHandActive=false;if(this.effectPayload?.kind==="hand")this.closeEffect();return;}
      this.presentHandCard(snapshot,"DRAW");this.nativeHandActive=false;return;
    }
    if(hand.phase==="JUDGE"||hand.phase==="REWARD_CHOICE"){this.presentHandCard(snapshot);return;}
    this.nativeHandActive=false;if(this.effectPayload?.kind==="hand")this.closeEffect();
  }
  feedbackBlocked() {
    return !!this.effect || ["preparing", "rolling", "settling"].includes(this.broker.snapshot?.phase);
  }
  deferFeedback(kind, payload, effects) {
    // One recent visual, never a second business command or an unbounded queue.
    this.pendingFeedback = { kind, payload, effects, createdAt: Date.now(),
      context: JSON.stringify(this.broker.snapshot?.saveContext || null) };
  }
  flushFeedback() {
    if (!this.pendingFeedback || this.quitting || this.feedbackBlocked()) return;
    const pending = this.pendingFeedback;
    this.pendingFeedback = null;
    if (Date.now() - pending.createdAt > 8000 || pending.context !== JSON.stringify(this.broker.snapshot?.saveContext || null)) return;
    if (pending.kind === "item") this.presentItemFx(pending.payload, pending.effects);
    else this.present(pending.payload);
  }
  present(snapshot) {
    if (this.quitting) return;
    const handCard=snapshot.kind === "hand";
    if (!handCard && (
      !snapshot.result ||
      snapshot.phase !== "revealed" ||
      snapshot.result.id === this.lastReveal
    ))
      return;
    if (!handCard && (this.effectPayload?.kind === "hand" ||
      (snapshot.result.mode === "score" && this.feedbackBlocked()))) {
      this.deferFeedback("reveal", snapshot);
      return;
    }
    if (!handCard && snapshot.result.mode !== "score") this.lastReveal = snapshot.result.id;
    if (!handCard && (!this.preferences.value.effectsEnabled || !snapshot.effects.enabled))
      return;
    this.closeEffect(false);
    const display = this.targetDisplay(),
      id = handCard ? snapshot.id : snapshot.result.id;
    const win = new BrowserWindow({
      ...display.bounds,
      transparent: true,
      frame: false,
      show: false,
      focusable: handCard,
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
    this.effectPayload = handCard ? snapshot : {
      id,
      theme: snapshot.theme === "marx" ? "marx" : "classic",
      result: snapshot.result,
      // Each reveal picks one of the ten presentations; an explicit choice wins.
      effects: { ...snapshot.effects, style: pickEffectStyle(snapshot.effects?.style) },
    };
    this.secure(win, "effect");
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(!handCard, { forward: true });
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
      handCard ? 180000 : snapshot.effects.duration + 6500,
    );
    win.loadURL(URLS.effect).catch((error) => {
      if (!win.isDestroyed()) {
        console.error("Effect load failed:", error.message);
        if (this.effect === win) this.closeEffect();
      }
    });
    this.broadcast();
  }
  closeEffect(resumeFeedback = true) {
    if(this.effectPayload?.kind==="hand")this.nativeHandActive=false;
    clearTimeout(this.effectTimeout);
    clearInterval(this.effectPointerTimer);
    this.effectPointerTimer=null;
    this.effectInteractive=false;
    const win = this.effect;
    this.effect = null;
    this.effectPayload = null;
    this.escape.release();
    if (win && !win.isDestroyed()) win.destroy();
    this.broadcast();
    if (resumeFeedback) this.flushFeedback();
  }
  /* The item cinematic is a second payload shape of the same full-screen
     window, so it inherits the verified topmost/escape/mouse behaviour. */
  presentItemFx(payload, effects) {
    if (this.quitting) return;
    if (!this.preferences.value.effectsEnabled) return;
    if (this.feedbackBlocked()) {
      this.deferFeedback("item", payload, effects);
      return;
    }
    this.closeEffect(false);
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
    ipcMain.handle("gp:ai", async (event, action, value) => {
      requireRole(event, "main");
      if (!["status", "configure", "request", "cancel", "clear", "openSource"].includes(action))
        return { ok: false, error: "不支持的AI请求" };
      const { AIGateway } = require("./ai-gateway.cjs");
      this.ai ||= new AIGateway({directory: app.getPath("userData"), safeStorage: require("electron").safeStorage});
      try {
        if(action==='openSource'){
          const {safeLink}=require('./ai-web-search.cjs');
          const url=typeof value==='string'&&value.length<=2000?safeLink(value):null;
          if(!url)return {ok:false,error:'来源链接无效'};
          await require('electron').shell.openExternal(url,{activate:true});return {ok:true};
        }
        if (action === "request") return await this.ai.request(value);
        if (action === "cancel") return typeof value === "string" ? this.ai.cancel(value) : {ok:false,error:"请求编号无效"};
        const config = action === "configure" ? await this.ai.configure(value)
          : action === "clear" ? await this.ai.clear()
          : (await this.ai.load(), this.ai.status());
        return { ok: true, config };
      } catch (error) {
        return { ok: false, error: error.message === "INVALID_CONFIGURATION" ? "模型配置无效" : String(error.message).startsWith("系统安全") ? error.message : "模型配置未保存，请检查本机权限" };
      }
    });
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
        const changed=this.broker.acceptSnapshot(sanitizeSnapshot(value));
        if(changed){this.pendingFeedback=null;this.closeEffect(false);this.lastReveal=null;}
        if (this.broker.ready) this.present(this.broker.snapshot);
        this.reconcileHandCard();
        this.flushFeedback();
        this.broadcast();
      } catch (error) {
        console.error("Rejected classroom snapshot:", error.message);
      }
    });
    ipcMain.on("gp:reply", (event, message) => {
      if (this.authorized(event, "main")) this.broker.reply(message);
    });
    ipcMain.on("gp:save-flush-reply",(event,message)=>{if(this.authorized(event,"main"))this.saveFlush.reply(message);});
    ipcMain.handle("gp:save-vault", (event, action, args) => {
      requireRole(event, "main");
      if (!this.saveVault) this.saveVault = new SaveVault({
        root: path.join(app.getPath("documents"), "GodPower", "save-library-v2"),
        schema: loadSaveSchema(this.root),
      });
      return dispatchSaveVault(this.saveVault, action, args);
    });
    ipcMain.handle("gp:save-file-info", async (event) => {
      requireRole(event, "main");
      await this.saveFile.whenIdle();
      return this.saveFile.info;
    });
    ipcMain.handle("gp:save-file-source", (event) => {
      requireRole(event,"main");
      return this.saveFile.readSource();
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
    ipcMain.handle("gp:command", async (event, request) => {
      requireRole(event, "picker");
      if (request?.clientEpoch !== this.pickerSession)
        return { ok: false, error: "STALE_CLIENT" };
      const result=await this.broker.command(request,`${event.sender.id}:${this.pickerSession}`);
      if(request.action==="handSelect" && result.ok){this.nativeHandActive=true;this.reconcileHandCard();}
      return result;
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
    ipcMain.handle("gp:hand-card-command", async(event,message)=>{
      requireRole(event,"effect");
      try {
        const safe=validateHandCardRequest(this.effectPayload,message,this.broker.snapshot?.saveContext);
        return await this.broker.command({...safe,epoch:this.broker.epoch},"hand-card:"+event.sender.id);
      }catch(error){return {ok:false,error:error.message};}
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
      {
        const win=this.effect,id=msg.id;
        const region=skipRegion(msg.region,win.getBounds());
        if(region&&this.effectPayload.kind!=='hand'){
          clearInterval(this.effectPointerTimer);
          const pointerTimer=setInterval(()=>{
            if(this.effect!==win||win.isDestroyed()||this.effectPayload?.id!==id){clearInterval(pointerTimer);if(this.effectPointerTimer===pointerTimer)this.effectPointerTimer=null;return;}
            const active=containsCursor(region,win.getBounds(),screen.getCursorScreenPoint());
            if(active===this.effectInteractive)return;
            this.effectInteractive=active;
            win.setIgnoreMouseEvents(!active,{forward:true});
          },50);
          this.effectPointerTimer=pointerTimer;
          pointerTimer.unref?.();
        }
        this.effectInteractive=this.effectPayload.kind==='hand'||msg.value;
        win.setIgnoreMouseEvents(!this.effectInteractive,{forward:true});
      }
    });
  }
}
module.exports = { Windows };
