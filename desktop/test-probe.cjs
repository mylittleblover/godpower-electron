/* Development-only real Electron integration probe. Excluded from distribution. */
const { app, BrowserWindow, screen, globalShortcut } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await delay(40);
  }
  throw Error("Timeout: " + label);
}
async function run(w, resultPath) {
  const results = [],
    errors = [];
  const dir = path.dirname(resultPath);
  fs.mkdirSync(dir, { recursive: true });
  const watch = (win) => {
    win.webContents.on("preload-error", (_e, _p, error) =>
      errors.push(error.message),
    );
    win.webContents.on("console-message", (e) => {
      if (e.level >= 3) errors.push(e.message);
    });
  };
  BrowserWindow.getAllWindows().forEach(watch);
  app.on("browser-window-created", (_e, win) => watch(win));
  const js = (win, code) =>
      Promise.race([
        win.webContents.executeJavaScript(code, true).catch((error) => {
          console.error("Failed renderer expression:", code);
          throw error;
        }),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                Error("Renderer evaluation timeout: " + code.slice(0, 100)),
              ),
            10000,
          ),
        ),
      ]),
    main = (code) => js(w.main, code),
    picker = (code) => js(w.picker, code);
  async function test(name, fn) {
    try {
      const detail = await fn();
      results.push({ name, status: "PASS", detail });
      console.log("PASS", name);
    } catch (error) {
      results.push({ name, status: "FAIL", error: error.stack });
      throw error;
    }
  }
  async function shot(win, name) {
    fs.writeFileSync(
      path.join(dir, name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  }
  try {
    if (process.argv.includes("--desktop-test-inject-setup-failure"))
      throw Error("Injected setup failure");
    await until(() => w.broker.ready && w.broker.snapshot, "main ready");
    w.main.setMenuBarVisibility(false);
    w.main.setContentSize(1920, 1080);
    w.main.webContents.setZoomFactor(1);
    await main(`document.getElementById('gpIntroSkip')?.click();closeWelcomeModal();state.isLocked=false;state.soundEnabled=false;ClassroomFeedback.setOptions({pickEffects:true,scoreEffects:false,duration:1200});
   state.groups=normalizeAllGroups(Array.from({length:14},(_,i)=>({id:i+1,groupNo:i+1,name:'第 '+(i+1)+' 小组',color:['#0f766e','#e76f51','#3d6eaa'][i%3],score:100+i*20,members:['0'+(i+1)+' 同学','学生 '+(i+1)]})));
   state.picker={mode:'individual',antiRepeat:true,pickedStudentKeys:[],pickedGroupIds:[],preselectedGroupIds:[]};
   state.itemGlobal.pickerHistory=[];state.columnMode='double';state.resizerEnabled=true;state.resizerHeight=120;state.zoomLevel=1;document.body.style.zoom=1;switchView('battle');renderAll();saveState();
   window.testSoundCalls=[];window.originalPlaySound=playSound;playSound=function(key,...args){testSoundCalls.push(key);return originalPlaySound(key,...args)};GodpowerPicker.notify('idle');`);
    await test("1920×1080 1x, 14 group fit and unchanged main layout", async () => {
      await delay(1100);
      const m = await main(
        `(()=>{const cards=[...document.querySelectorAll('#groupList>.group-row-card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}});const dock=document.querySelector('.bottom-dock').getBoundingClientRect();return {viewport:[innerWidth,innerHeight],zoom:devicePixelRatio,cards,dockTop:dock.top}})()`,
      );
      assert.deepEqual(m.viewport, [1920, 1080]);
      assert.equal(m.cards.length, 14);
      assert.ok(m.cards.every((c) => c.bottom <= m.dockTop));
      fs.writeFileSync(
        path.join(dir, "battle14-dom.json"),
        JSON.stringify(m, null, 2),
      );
      await shot(w.main, "battle14");
      return m.viewport;
    });
    await test("native functional windows forward inputs and preserve single score owner", async () => {
      await main(`openScoreModal(1)`);
      await until(
        () => w.detached.entries.has("scoreModalBackdrop"),
        "native score created",
      );
      const entry = w.detached.entries.get("scoreModalBackdrop"),
        win = entry.win;
      await until(() => !win.webContents.isLoading(), "native score loaded");
      await until(
        () =>
          js(
            win,
            `!!document.querySelector('#scoreModalInput') || !!document.querySelector('input')`,
          ),
        "score input",
      );
      await delay(600);
      await shot(win, "native-score");
      const before = await main(`state.groups[0].score`);
      await js(
        win,
        `(()=>{const input=document.querySelector('input');for(const value of ['1','12','17']){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}[...document.querySelectorAll('button')].find(b=>/确定赋分/.test(b.textContent)).click();})()`,
      );
      const prefs = win.webContents.getLastWebPreferences();
      assert.equal(prefs.sandbox, true);
      assert.equal(prefs.nodeIntegration, false);
      assert.equal(await js(win, `typeof require`), "undefined");
      assert.equal(
        await js(win, `localStorage.getItem('godpower_state_v1')`),
        null,
      );
      await until(
        async () => (await main(`state.groups[0].score`)) === before + 17,
        "single score commit",
      );
      await until(
        () => !w.detached.entries.has("scoreModalBackdrop"),
        "native score closes",
      );
      // Reopening and refreshing must reset transport input counters, not classroom data.
      await main(`openScoreModal(1)`);
      await until(
        () => w.detached.entries.has("scoreModalBackdrop"),
        "reopened score",
      );
      const reopened = w.detached.entries.get("scoreModalBackdrop");
      await until(
        () => !reopened.win.webContents.isLoading(),
        "reopened score loaded",
      );
      await until(
        () => js(reopened.win, `!!document.getElementById('modalCustomInput')`),
        "reopened score presented",
      );
      await js(
        reopened.win,
        `(()=>{const e=document.getElementById('modalCustomInput');e.value='21';e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await until(
        () => main(`document.getElementById('modalCustomInput').value==='21'`),
        "new session accepts input",
      );
      const oldSession = reopened.session;
      reopened.win.reload();
      await until(
        () =>
          !reopened.win.webContents.isLoading() &&
          reopened.session !== oldSession,
        "fresh native transport",
      );
      await until(
        () => js(reopened.win, `!!document.getElementById('modalCustomInput')`),
        "refreshed score presented",
      );
      await js(
        reopened.win,
        `(()=>{const e=document.getElementById('modalCustomInput');e.value='22';e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await until(
        () => main(`document.getElementById('modalCustomInput').value==='22'`),
        "refresh accepts input",
      );
      reopened.win.close();
      await until(
        () => !w.detached.entries.has("scoreModalBackdrop"),
        "reopened score cancelled",
      );
      assert.equal(await main(`state.groups[0].score`), before + 17);
      for (const [id, open] of [
        ["memberSearchBackdrop", "openMemberSearchModal()"],
        ["pwdModal", "openPwdModal()"],
        ["itemModalBackdrop", "openItemWindow(1)"],
        ["handRaiseBackdrop", "openHandRaise()"],
        ["aboutBackdrop", "openAbout()"],
        ["batchImportModal", "openBatchImportModal()"],
        ["quickPersonBackdropV218", "openQuickPersonScoreV218()"],
        ["themeDialogV21727", "void themeAlert('独立警告窗口测试')"],
        ["programConfirmV28", "void programConfirmV28('独立确认窗口测试')"],
        [
          "settlementNameModal",
          "showClassroomWindow(document.getElementById('settlementNameModal'))",
        ],
        [
          "grandModalOverlay",
          "showClassroomWindow(document.getElementById('grandModalOverlay'))",
        ],
      ]) {
        await main(open);
        await until(() => w.detached.entries.has(id), id + " created");
        const e = w.detached.entries.get(id);
        await until(() => !e.win.webContents.isLoading(), id + " ready");
        await until(
          () => js(e.win, `!!document.querySelector('#mount > *')`),
          id + " presented",
        );
        await e.win.webContents.capturePage();
        await until(
          () =>
            js(
              e.win,
              `document.getElementById('mount').getAnimations().every(a=>a.playState==='finished')`,
            ),
          id + " entrance completed",
        );
        await delay(100);
        assert.equal(
          await main(
            `(()=>{const e=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});document.dispatchEvent(e);return e.defaultPrevented})()`,
          ),
          false,
          id + " does not trap keyboard in hidden main modal",
        );
        const geometry = await js(
          e.win,
          `(()=>{const root=document.querySelector('#mount > *');return {viewport:[innerWidth,innerHeight],body:document.body.className,root:root.outerHTML.slice(0,160),children:[...root.children].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {tag:e.tagName,class:e.className,x:r.x,y:r.y,width:r.width,height:r.height,display:c.display,opacity:c.opacity,visibility:c.visibility}})}})()`,
        );
        if (id === "grandModalOverlay")
          assert.equal(
            await js(
              e.win,
              `(()=>{const c=document.querySelector('#confettiCanvas');return !!c && c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)})()`,
            ),
            true,
            "native celebration canvas renders pixels",
          );
        console.log("Native geometry", id, JSON.stringify(geometry));
        const surface = geometry.children.find((e) =>
          e.class.includes("ui-function-surface"),
        );
        assert.ok(
          surface && surface.width > 0 && surface.height > 0,
          id + " visible surface",
        );
        assert.ok(
          surface.x >= -1 &&
            surface.y >= -1 &&
            surface.x + surface.width <= geometry.viewport[0] + 1 &&
            surface.y + surface.height <= geometry.viewport[1] + 1,
          id +
            " surface fits native content bounds: " +
            JSON.stringify(surface),
        );
        fs.writeFileSync(
          path.join(dir, "native-" + id + "-dom.json"),
          JSON.stringify(geometry, null, 2),
        );
        await shot(e.win, "native-" + id);
        if (id === "pwdModal") {
          await main(`state.adminPin='test123';state.isLocked=true`);
          for (const ch of "test123") {
            await js(
              e.win,
              `(()=>{const input=document.querySelector('#pwdInput');input.value+=${JSON.stringify(ch)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
            );
            await delay(160);
          }
          assert.equal(
            await js(e.win, `document.querySelector('#pwdInput').value`),
            "test123",
          );
          assert.equal(e.snapshot.html.includes('value="test123"'), false);
          await js(
            e.win,
            `document.querySelector('#pwdInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`,
          );
          await until(
            () => main(`state.isLocked===false`),
            "native password accepted",
          );
        } else e.win.close();
        await until(() => !w.detached.entries.has(id), id + " closed");
        await delay(600);
        assert.equal(
          await main(
            `!!document.getElementById('${id}')?.hasAttribute('data-native-detached')`,
          ),
          false,
        );
      }
      return "12 native windows, rapid input forwarding, one score commit, isolated storage";
    });
    await test("fullscreen sound slots are configurable and score reveal is a native overlay", async () => {
      const slots = await main(
        `FX_SOUND_SLOTS.filter(s=>s.category==='全屏演出').map(s=>s.id)`,
      );
      assert.deepEqual(slots, [
        "fullscreen_pick",
        "fullscreen_score_add",
        "fullscreen_score_sub",
      ]);
      await main(
        `ClassroomFeedback.setOptions({scoreEffects:true});ClassroomFeedback.score('音效测试小组',5)`,
      );
      await until(() => !!w.effect, "score effect");
      await until(() => !w.effect.webContents.isLoading(), "score effect load");
      await until(
        () =>
          js(w.effect, `document.getElementById('name').textContent==='+5'`),
        "score reveal",
      );
      assert.equal(w.effectPayload.result.color, "#15916a");
      assert.ok(await main(`testSoundCalls.includes('fullscreen_score_add')`));
      await delay(1000);
      await shot(w.effect, "native-score-effect");
      w.closeEffect();
      await main(`ClassroomFeedback.score('音效测试小组',-3)`);
      await until(() => !!w.effect, "negative effect");
      assert.equal(w.effectPayload.result.color, "#da4f51");
      assert.ok(await main(`testSoundCalls.includes('fullscreen_score_sub')`));
      w.closeEffect();
      await main(`ClassroomFeedback.setOptions({scoreEffects:false})`);
      return slots;
    });
    await test("secure preload and isolated origin in independent picker", async () => {
      w.openPicker();
      await until(
        () => w.picker && !w.picker.webContents.isLoading(),
        "picker loaded",
      );
      await until(() => picker(`!!current?.ready`), "picker connected");
      assert.deepEqual(
        [w.picker.getBounds().width, w.picker.getBounds().height],
        [72, 72],
      );
      assert.equal(await picker(`document.body.dataset.collapsed`), "true");
      await shot(w.picker, "picker-icon");
      await picker(`godpowerDesktop.windowAction('expand')`);
      await until(
        () => picker(`document.body.dataset.collapsed==='false'`),
        "expanded panel",
      );
      assert.ok(w.picker.getBounds().height >= 520);
      const expanded = w.picker.getBounds();
      await picker(`godpowerDesktop.windowAction('collapse')`);
      assert.equal(w.picker.getBounds().width, 72);
      const getCursor = screen.getCursorScreenPoint;
      let cursor = { x: 100, y: 100 };
      screen.getCursorScreenPoint = () => cursor;
      try {
        const start = w.picker.getBounds();
        await picker(`godpowerDesktop.windowAction('dragStart')`);
        cursor = { x: 60, y: 180 };
        await picker(`godpowerDesktop.windowAction('dragEnd')`);
        assert.equal(w.pickerCollapsed, true);
        assert.notEqual(w.picker.getBounds().y, start.y);
      } finally {
        screen.getCursorScreenPoint = getCursor;
      }
      await picker(`godpowerDesktop.windowAction('expand')`);
      assert.deepEqual(w.picker.getBounds(), expanded);
      const security = await picker(
        `({node:typeof require,process:typeof process,role:godpowerDesktop.role,mainAPI:typeof godpowerDesktop.publish,storage:localStorage.getItem('godpower_state_v1')})`,
      );
      assert.deepEqual(security, {
        node: "undefined",
        process: "undefined",
        role: "picker",
        mainAPI: "undefined",
        storage: null,
      });
      for (const win of [w.main, w.picker]) {
        const prefs = win.webContents.getLastWebPreferences();
        assert.equal(prefs.contextIsolation, true);
        assert.equal(prefs.sandbox, true);
        assert.equal(prefs.webSecurity, true);
        assert.equal(prefs.nodeIntegration, false);
      }
      await until(
        () => picker(`current.snapshot.groups.length===14`),
        "picker current classroom",
      );
      await w.picker.webContents.capturePage();
      await delay(500);
      await shot(w.picker, "picker-ready");
      return security;
    });
    await test("closing main keeps authoritative renderer alive and can restore it", async () => {
      const wc = w.main.webContents.id,
        before = await main(`state.groups.map(g=>g.score)`);
      w.main.close();
      await delay(150);
      assert.equal(w.main.isDestroyed(), false);
      assert.equal(w.main.isVisible(), false);
      assert.equal(w.main.webContents.id, wc);
      assert.equal(w.broker.ready, true);
      assert.equal(
        (await picker(`godpowerDesktop.command('mode',{mode:'group'})`)).ok,
        true,
      );
      assert.deepEqual(await main(`state.groups.map(g=>g.score)`), before);
      w.showMain();
      assert.equal(w.main.isVisible(), true);
      return "same renderer and data after close; picker commands remain available";
    });
    for (const mode of ["individual", "group", "two_tier"])
      await test(
        mode + " authoritative draw, continuous reel, overlay and score",
        async () => {
          await picker(`godpowerDesktop.command('mode',{mode:'${mode}'})`);
          await until(
            () => w.broker.snapshot.mode === mode,
            "mode synchronized",
          );
          const soundsBefore = await main(
            "({start:testSoundCalls.filter(x=>x==='ui_button_pick_start').length,stop:testSoundCalls.filter(x=>x==='ui_button_pick_stop').length,win:testSoundCalls.filter(x=>x==='roll_win').length})",
          );
          w.main.minimize();
          await picker(`document.getElementById('lever').click()`);
          await until(
            () => w.broker.snapshot.phase === "rolling",
            "rolling",
          ).catch(async (error) => {
            console.error(
              "Start diagnostics",
              await picker(
                `({message:document.getElementById('message').textContent,pending,phase:current.snapshot.phase})`,
              ),
              await main(
                `({phase:GodpowerPicker.getSnapshot().phase,active:document.getElementById('pickerModal').className,spinning:slotEngine.isSpinning,groups:state.groups.length,locked:state.isLocked})`,
              ),
            );
            throw error;
          });
          const secret = await main(`slotEngine.chosenResult`);
          assert.ok(secret);
          assert.equal(w.broker.snapshot.result, null);
          await shot(w.picker, "picker-" + mode + "-rolling");
          const count = await main(`state.itemGlobal.pickerHistory.length`);
          await picker(`document.getElementById('lever').click()`);
          await until(() => w.broker.snapshot.phase === "settling", "settling");
          await until(
            () => w.effect && !w.effect.webContents.isLoading(),
            "overlay created",
          );
          await until(
            () =>
              js(
                w.effect,
                `document.getElementById('stage').classList.contains('active')`,
              ),
            "overlay ready",
          );
          const soundsAfter = await main(
            "({start:testSoundCalls.filter(x=>x==='ui_button_pick_start').length,stop:testSoundCalls.filter(x=>x==='ui_button_pick_stop').length,win:testSoundCalls.filter(x=>x==='roll_win').length})",
          );
          for (const key of ["start", "stop", "win"])
            assert.equal(
              soundsAfter[key] - soundsBefore[key],
              1,
              "one " + key + " audio dispatch per draw",
            );
          const result = w.broker.snapshot.result;
          assert.equal(w.broker.snapshot.phase, "revealed");
          assert.equal(
            await js(w.effect, `document.getElementById('name').textContent`),
            result.name,
          );
          assert.equal(await picker(`current.snapshot.result.id`), result.id);
          assert.equal(
            await main(`state.itemGlobal.pickerHistory.length`),
            count + 1,
          );
          assert.equal(
            await js(w.effect, `typeof godpowerDesktop.command`),
            "undefined",
          );
          assert.equal(w.effect.isFocusable(), false);
          await delay(1100);
          const filter = await js(
            w.effect,
            `getComputedStyle(document.querySelector('.reveal')).filter`,
          );
          assert.ok(
            filter === "none" || parseFloat(filter.replace("blur(", "")) < 1,
            "revealed name becomes sharp: " + filter,
          );
          await shot(w.effect, "effect-" + mode);
          await shot(w.picker, "picker-" + mode + "-result");
          if (mode !== "two_tier") {
            await picker(`godpowerDesktop.windowAction('skip')`);
            assert.equal(w.effect, null);
          } else await until(() => !w.effect, "automatic overlay close", 6000);
          const before = await main(
            `state.groups.find(g=>g.id===${result.groupId}).score`,
          );
          const response = await picker(
            `godpowerDesktop.command('score',{resultId:${JSON.stringify(result.id)},delta:5})`,
          );
          assert.equal(response.ok, true);
          assert.equal(
            await main(`state.groups.find(g=>g.id===${result.groupId}).score`),
            before + 5,
          );
          const stale = await picker(
            `godpowerDesktop.command('score',{resultId:'stale',delta:5})`,
          );
          assert.equal(stale.ok, false);
          return {
            resultId: result.id,
            groupId: result.groupId,
            historyEntries: 1,
            scoreDelta: 5,
          };
        },
      );
    await test("close/reopen while spinning keeps one engine and retained window bounds", async () => {
      const b = { x: 100, y: 80, width: 480, height: 760 };
      w.picker.setBounds(b);
      await picker(`godpowerDesktop.command('start')`);
      await until(() => w.broker.snapshot.phase === "rolling", "rolling");
      const chosen = await main(`slotEngine.chosenResult`);
      const closing = w.picker;
      w.picker.close();
      w.openPicker();
      await until(
        () =>
          w.picker && w.picker !== closing && !w.picker.webContents.isLoading(),
        "reopened",
      );
      await until(
        () => picker(`current?.snapshot?.phase==='rolling'`),
        "rolling synchronized",
      );
      assert.deepEqual(await main(`slotEngine.chosenResult`), chosen);
      assert.equal(w.pickerCollapsed, true);
      assert.equal(w.picker.getBounds().width, 72);
      await picker(`godpowerDesktop.windowAction('expand')`);
      assert.deepEqual(w.picker.getBounds(), b);
      await picker(`godpowerDesktop.command('cancel')`);
      await until(() => w.broker.snapshot.phase === "idle", "cancelled");
      await picker(`godpowerDesktop.windowAction('pin',false)`);
      assert.equal(w.preferences.value.alwaysOnTop, false);
      await picker(`godpowerDesktop.windowAction('pin',true)`);
      assert.equal(w.preferences.value.alwaysOnTop, true);
      return {
        bounds: w.picker.getBounds(),
        alwaysOnTop: w.picker.isAlwaysOnTop(),
      };
    });
    await test("picker reload accepts fresh commands without sequence conflicts", async () => {
      const old = w.picker.webContents.id;
      w.picker.reload();
      await until(
        () => !w.picker.webContents.isLoading(),
        "picker reload finished",
      );
      await until(() => picker("current?.ready"), "picker reload connected");
      assert.equal(w.picker.webContents.id, old);
      const r = await picker("godpowerDesktop.command('mode',{mode:'group'})");
      assert.equal(r.ok, true, JSON.stringify(r));
    });
    await test("duplicate effect ready always releases Escape registration", async () => {
      const snapshot = structuredClone(w.broker.snapshot);
      snapshot.phase = "revealed";
      snapshot.result = {
        id: "ready-replay",
        mode: "group",
        groupId: 1,
        groupName: "一组",
        groupNo: 1,
        name: "一组",
        number: null,
        color: "#0f766e",
        score: 1,
      };
      snapshot.effects.enabled = true;
      w.present(snapshot);
      await until(
        () => w.effect && !w.effect.webContents.isLoading(),
        "effect ready",
      );
      await js(w.effect, "godpowerDesktop.ready();godpowerDesktop.ready()");
      await delay(80);
      const registered = globalShortcut.isRegistered("Escape");
      w.closeEffect();
      assert.equal(globalShortcut.isRegistered("Escape"), false);
      return { registeredBeforeClose: registered };
    });
    await test("effect interrupts and stale finish cannot close a newer result", async () => {
      const snapshot = structuredClone(w.broker.snapshot);
      snapshot.phase = "revealed";
      snapshot.result = {
        id: "test-old",
        mode: "group",
        groupId: 1,
        groupName: "一组",
        groupNo: 1,
        name: "一组",
        number: null,
        color: "#0f766e",
        score: 1,
      };
      snapshot.effects.enabled = true;
      w.present(snapshot);
      const old = w.effect;
      snapshot.result.id = "test-new";
      w.present(snapshot);
      assert.equal(old.isDestroyed(), true);
      assert.ok(w.effect);
      w.closeEffect();
      assert.equal(w.effect, null);
    });
    await test("reload cancels transient picker, preserves classroom storage and rejects stale outcome", async () => {
      await main(
        `saveState();localStorage.setItem('electron-020-marker','preserved')`,
      );
      await picker(`godpowerDesktop.command('start')`);
      const epoch = w.broker.epoch;
      w.main.reload();
      await until(
        () =>
          w.broker.epoch !== epoch &&
          w.broker.ready &&
          w.broker.snapshot?.phase === "idle",
        "reload recovery",
        30000,
      );
      assert.equal(
        await main(`localStorage.getItem('electron-020-marker')`),
        "preserved",
      );
      assert.equal(await main(`state.groups.length`), 14);
      assert.equal(await main(`slotEngine.isSpinning`), false);
      assert.equal(w.effect, null);
    });
    await test("custom audio/resource store remains accessible to main only", async () => {
      const info = await main(
        `(async()=>{const request=indexedDB.open('electron-020-audio-test',1);const db=await new Promise((r,j)=>{request.onupgradeneeded=()=>request.result.createObjectStore('audio');request.onsuccess=()=>r(request.result);request.onerror=()=>j(request.error)});await new Promise((r,j)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(new Blob(['test'],{type:'audio/wav'}),'track');tx.oncomplete=r;tx.onerror=j});db.close();return {indexedDB:typeof indexedDB,items:Object.keys(ITEM_DEFS).length}})()`,
      );
      assert.equal(info.items, 26);
      assert.equal(info.indexedDB, "object");
      return info;
    });
    await test("main renderer crash blocks commands until explicit recovery without reroll", async () => {
      w.main.webContents.forcefullyCrashRenderer();
      await until(() => w.crashed && !w.broker.ready, "renderer gone");
      const r = await picker(`godpowerDesktop.command('start')`);
      assert.equal(r.ok, false);
      w.showMain();
      await until(
        () => w.broker.ready && w.broker.snapshot?.phase === "idle",
        "renderer restored",
      );
      assert.equal(await main(`state.groups.length`), 14);
      assert.equal(w.effect, null);
    });
    assert.deepEqual(errors, [], "no renderer/preload errors");
    await main(`openAbout()`);
    await until(
      () => w.detached.entries.has("aboutBackdrop"),
      "exit with auxiliary window open",
    );
  } catch (error) {
    errors.push(error.stack || String(error));
    console.error("Integration probe failed:", error.stack);
  } finally {
    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          status:
            results.some((x) => x.status === "FAIL") || errors.length
              ? "FAIL"
              : "PASS",
          results,
          errors,
          environment: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            platform: process.platform,
            displays: screen
              .getAllDisplays()
              .map((d) => ({ bounds: d.bounds, scaleFactor: d.scaleFactor })),
          },
        },
        null,
        2,
      ),
    );
    app.quit();
  }
}
module.exports = { run };
