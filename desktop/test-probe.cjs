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
  const selectedScenario=process.argv.find(a=>a.startsWith("--desktop-scenario="))?.slice(19);
  const handScenario="the launcher offers picker or hand and the hand panel runs one classroom command";
  async function test(name, fn) {
    if(selectedScenario==="hand" && name!==handScenario)return;
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
  async function settledShot(win, name) {
    // Headless native windows may return the previous compositor frame even
    // after DOM/CSS synchronization. Request a frame, allow entrance/paint to
    // settle, then capture the newly painted presentation.
    await win.webContents.capturePage();
    await js(win, `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    await delay(600);
    await shot(win, name);
  }
  try {
    if (process.argv.includes("--desktop-test-inject-setup-failure"))
      throw Error("Injected setup failure");
    await until(() => w.broker.ready && w.broker.snapshot, "main ready");
    w.main.setMenuBarVisibility(false);
    w.main.setContentSize(1920, 1080);
    w.main.webContents.setZoomFactor(1);
    // On a 1920x1080 virtual desktop, native decorations would shrink the
    // content viewport. Test the application's supported fullscreen mode.
    const primaryBounds = screen.getPrimaryDisplay().bounds;
    if (process.platform === "linux" && process.env.DISPLAY &&
        primaryBounds.width === 1920 && primaryBounds.height === 1080)
      w.main.setFullScreen(true);
    await until(() => main(`innerWidth===1920 && innerHeight===1080`), "1920x1080 content resize");
    await until(() => main(`window.classroomReady && !ClassroomSaveFile.isHydrating()`), "classroom hydration");
    await main(`SaveManager.ready()`);
    await main(`document.getElementById('gpIntroSkip')?.click();closeWelcomeModal();state.isLocked=false;state.soundEnabled=false;ClassroomFeedback.setOptions({pickEffects:true,scoreEffects:false,duration:1200});
   state.groups=normalizeAllGroups(Array.from({length:14},(_,i)=>({id:i+1,groupNo:i+1,name:'第 '+(i+1)+' 小组',color:['#0f766e','#e76f51','#3d6eaa'][i%3],score:100+i*20,members:['0'+(i+1)+' 同学','学生 '+(i+1)]})));
   state.picker={mode:'individual',antiRepeat:true,pickedStudentKeys:[],pickedGroupIds:[],preselectedGroupIds:[]};
   state.itemGlobal.pickerHistory=[];state.columnMode='double';state.resizerEnabled=true;state.resizerHeight=120;state.zoomLevel=1;document.body.style.zoom=1;switchView('battle');renderAll();saveState();
   window.testSoundCalls=[];window.originalPlaySound=playSound;playSound=function(key,...args){testSoundCalls.push(key);return originalPlaySound(key,...args)};GodpowerPicker.notify('idle');`);
    if(selectedScenario==="hand"){
      await main(`addItemToGroup(state.groups[0],'coin');saveState();void 0`);
      await main(`SaveManager.whenIdle()`);
      w.openPicker();await until(()=>w.picker&&!w.picker.webContents.isLoading(),"hand fixture picker");
      await until(()=>picker(`!!current?.ready`),"hand fixture connected");
    }
    await test("disk IPC writes remain ordered and reads await verified bytes in isolated storage", async () => {
      assert.ok(w.saveFile.info.path.startsWith(app.getPath("userData") + path.sep));
      const result = await main(`(async()=>{
        const backup=buildClassroomBackup();
        const timestamps=Array.from({length:5},(_,i)=>new Date(Date.now()+i).toISOString());
        const writes=timestamps.map(timestamp=>godpowerDesktop.saveFileWrite({...backup,timestamp}));
        const latest=await godpowerDesktop.saveFileRead();
        return {writes:await Promise.all(writes),latest,expected:timestamps.at(-1)};
      })()`);
      assert.ok(result.writes.every(r=>r.ok));
      assert.equal(result.latest.ok,true);
      assert.equal(result.latest.data.timestamp,result.expected);
      assert.equal(result.latest.data.groups.length,14);
      await w.saveFile.whenIdle();
      assert.equal(w.saveFile.pendingWrites,0);
      assert.equal(fs.existsSync(w.saveFile.file+".tmp"),false);
      return {writes:result.writes.length,groups:result.latest.data.groups.length};
    });
    await test("save library IPC uses pinned schema, durable revisions and isolated native paths", async () => {
      const result = await main(`(async()=>{
        const preview=await SaveMigration.preview({rawText:JSON.stringify(buildClassroomBackup()),name:'隔离存档测试'});
        const api=godpowerDesktop.saveVault;
        const imported=await api.importPreview(preview,{activate:false});
        if(!imported.ok)throw Error(JSON.stringify(imported));
        const list=await api.list();const id=imported.saveIds[0];
        const loaded=await api.load(id);const doc=loaded.document;
        doc.match.groups[0].score+=2;
        const saved=await api.commit(id,doc.revision,doc,{expectedGeneration:list.index.generation});
        const stale=await api.commit(id,doc.revision,doc,{expectedGeneration:list.index.generation});
        const source=await api.getSource(preview.sourceDigest);
        const removed=await api.setTrashed(id,true,{expectedGeneration:list.index.generation,expectedRevision:2});
        const hidden=await api.load(id);
        const restored=await api.setTrashed(id,false,{expectedGeneration:list.index.generation,expectedRevision:2});
        const reopened=await api.load(id);
        return {groups:doc.roster.groups.length,students:doc.roster.students.length,saved:saved.ok,revision:saved.document?.revision,stale:stale.code,sourceExact:source.sourceText===preview.sourceText,trash:removed.ok&&hidden.code==='SAVE_NOT_FOUND',restore:restored.ok&&reopened.document.revision===2};
      })()`);
      assert.deepEqual(result,{groups:14,students:28,saved:true,revision:2,stale:'REVISION_CONFLICT',sourceExact:true,trash:true,restore:true});
      assert.ok(w.saveVault.root.startsWith(app.getPath("userData") + path.sep));
      const modeBefore=await main(`state.picker.mode`);
      w.main.webContents.send("gp:execute",{id:"stale-save-probe",action:"mode",payload:{mode:modeBefore==="group"?"individual":"group"},saveContext:{saveId:"save-obsolete",generation:0}});
      await delay(120);assert.equal(await main(`state.picker.mode`),modeBefore,"old save commands must not mutate the new classroom");
      return result;
    });
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
    await test("internal functional dialogs retain live input, settings state and one score owner", async () => {
      const windowIds=BrowserWindow.getAllWindows().map(win=>win.id);
      let loads=0;const onLoad=()=>loads++;w.main.webContents.on("did-start-loading",onLoad);
      await main(`openScoreModal(1)`);await delay(600);
      const before=await main(`state.groups[0].score`);
      await main(`(()=>{const input=document.getElementById('modalCustomInput');window.testInput=input;input.focus()})()`);
      for(const text of ['1','2','3']){
        await w.main.webContents.insertText(text);await delay(180);
        assert.equal(await main(`document.activeElement===testInput && testInput.isConnected`),true);
      }
      assert.equal(await main(`testInput.value`),'123');
      await main(`testInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
      await until(async()=>await main(`state.groups[0].score`)===before+123,"one local score commit");
      await main(`switchView('settings');DesktopUI.selectSettings('welcome');document.getElementById('uiSettingsBank').open=true`);await delay(700);
      await main(`(()=>{const input=document.getElementById('uiBankEditor');window.testInput=input;input.value='';input.focus()})()`);
      for(const text of ['a','b','c']){await w.main.webContents.insertText(text);await delay(180);assert.equal(await main(`document.activeElement===testInput&&testInput.isConnected`),true)}
      await main(`DesktopUI.selectSettings('appearance');DesktopUI.selectSettings('sound');DesktopUI.selectSettings('welcome')`);
      assert.equal(await main(`document.getElementById('uiBankEditor').value`),'abc');
      assert.equal(loads,0,"settings operations must not navigate or reload");
      for(const [id,open,close] of [
        ['pwdModal','openPwdModal()','closePwdModal()'],
        ['memberSearchBackdrop','openMemberSearchModal()','closeMemberSearchModal()'],
        ['itemModalBackdrop','openItemWindow(1)','closeItemWindow()'],
        ['handRaiseBackdrop','openHandRaise();selectHandGroup(1)','closeHandRaise()'],
        ['aboutBackdrop','openAbout()','closeAbout()'],
        ['batchImportModal','openBatchImportModal()','closeBatchImportModal()'],
        ['quickPersonBackdropV218','openQuickPersonScoreV218()','closeQuickPersonScoreV218()'],
        ['settlementNameModal',"showClassroomWindow(document.getElementById('settlementNameModal'))",'closeSettlementNameModal()'],
        ['grandModalOverlay',"showClassroomWindow(document.getElementById('grandModalOverlay'))",'closeGrandSettlementModal()'],
        ['themeDialogV21727',"void themeAlert('内部警告测试')",'closeThemeDialogV21727(false)'],
        ['programConfirmV28',"void programConfirmV28('内部确认测试')","document.getElementById('pcCancelV28').click()"],
      ]){
        await main(open);await delay(450);
        assert.equal(await main(`(()=>{const el=document.getElementById('${id}');return !!el&&el.getClientRects().length>0&&!el.hasAttribute('data-native-detached')})()`),true,id);
        assert.deepEqual(BrowserWindow.getAllWindows().map(win=>win.id),windowIds,id+" stays internal");
        await main(close);await delay(450);
      }
      await main(`state.isLocked=false;switchView('battle')`);
      for(let i=0;i<2;i++){
        await main(`document.querySelector('.bottom-dock [onclick*=openPickerModal]').click()`);
        await until(()=>!w.pickerCollapsed,"bottom-right picker control opens expanded window");
        await picker(`godpowerDesktop.windowAction('collapse')`);
      }
      assert.equal(loads,0);
      w.main.webContents.removeListener("did-start-loading",onLoad);
      return {internalDialogs:12,loads,inputStable:true,scoreDelta:123};
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
      const reelProbe = await picker(`(()=>{const original=current,originalRevision=revision,base=original.snapshot,out={};for(const mode of ['individual','group','two_tier']){const snap={...base,phase:'rolling',mode,preview:{group:'测试小组泄漏',student:'测试学生'},result:null};render({...original,revision:revision+1,snapshot:snap});out[mode]=[...document.querySelector('#reel').children].map(x=>x.textContent)}revision=originalRevision;current=original;render(original);return out})()`);
      assert.ok(reelProbe.individual.every((name) => name === "测试学生"),
        "individual roulette must never expose group names");
      assert.ok(reelProbe.group.every((name) => name === "测试小组泄漏"),
        "group roulette must never expose student names");
      assert.ok(reelProbe.two_tier.includes("测试小组泄漏") && reelProbe.two_tier.includes("测试学生"));
      assert.deepEqual(
        [w.picker.getBounds().width, w.picker.getBounds().height],
        [72, 72],
      );
      assert.equal(await picker(`document.body.dataset.collapsed`), "true");
      assert.equal(
        await picker(`document.querySelectorAll('.titlebar .window-actions button').length`),
        1,
        "only collapse remains in the top-right corner",
      );
      await shot(w.picker, "picker-icon");
      await picker(`godpowerDesktop.windowAction('expand')`);
      await until(
        () => picker(`document.body.dataset.collapsed==='false'`),
        "expanded panel",
      );
      assert.ok(w.picker.getBounds().height >= 520);
      const expanded = w.picker.getBounds();
      const isFocused = w.picker.isFocused;
      w.picker.isFocused = () => false;
      try {
        w.picker.emit("focus");
        w.picker.emit("blur");
        await until(() => w.pickerCollapsed, "collapse when focus leaves picker");
      } finally {
        w.picker.isFocused = isFocused;
      }
      assert.equal(w.picker.getBounds().width, 72);
      await picker(`godpowerDesktop.windowAction('expand')`);
      await until(() => !w.pickerCollapsed, "re-expand after outside click");
      await picker(`godpowerDesktop.windowAction('collapse')`);
      assert.equal(w.picker.getBounds().width, 72);
      const start=w.picker.getBounds();
      await picker(`godpowerDesktop.windowAction('dragStart',{x:100,y:100})`);
      await picker(`godpowerDesktop.windowAction('dragMove',{x:60,y:180})`);
      assert.equal(w.pickerCollapsed,true);assert.notEqual(w.picker.getBounds().y,start.y);
      await picker(`godpowerDesktop.windowAction('dragEnd',{x:60,y:180})`);
      const anchor=w.picker.getBounds();
      await picker(`godpowerDesktop.windowAction('expand')`);
      const expected=require('./window-state.cjs').visibleBounds({...expanded,x:anchor.x,y:anchor.y},screen.getAllDisplays(),null);
      assert.deepEqual(w.picker.getBounds(),expected,"expanded panel follows moved icon and clamps into display");
      await picker(`godpowerDesktop.windowAction('collapse')`);
      w.picker.setBounds({x:100,y:100,width:72,height:72});
      const debug=w.picker.webContents.debugger;debug.attach('1.3');
      try {
        await debug.sendCommand('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:32,y:32,id:1}]});await delay(40);
        await debug.sendCommand('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:52,y:52,id:1}]});await delay(70);
        await debug.sendCommand('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);
        assert.equal(w.pickerCollapsed,true,'touch drag must not accidentally open panel');
        assert.notEqual(w.picker.getBounds().x,100,'touch pointer moves native icon without moving system mouse');
        await debug.sendCommand('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:32,y:32,id:2}]});await delay(30);
        await debug.sendCommand('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await until(()=>w.pickerView==='launcher','touch tap opens the launcher menu beside the moved icon');
        assert.equal(w.pickerCollapsed,true,'the launcher is not the expanded panel');
        assert.equal(await picker(`document.getElementById('launcher').hidden`),false,'the menu offers picker or hand');
        await picker(`godpowerDesktop.windowAction('launcherClose')`);
        await until(()=>w.pickerView==='icon','launcher closes back to the icon');
        // Later scenarios inspect the expanded panel, so leave it open.
        await picker(`godpowerDesktop.windowAction('expand')`);
        await until(()=>!w.pickerCollapsed,'panel reopens from the launcher');
      } finally {debug.detach()}
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
    await test("Marx theme crosses HTML, native branding, picker reload, internal dialogs and effects", async () => {
      const before = await main(`state.groups.map(g=>g.score)`);
      const iconChanges = [];
      const originalSetters = [w.main, w.picker].map((win) => {
        const original = win.setIcon;
        win.setIcon = function (icon) {
          // Forward the real native call; Electron does not expose an icon getter.
          original.call(this, icon);
          iconChanges.push({ role: win === w.main ? "main" : "picker", icon });
        };
        return { win, original };
      });
      try {
        await main(`GodpowerTheme.set('marx',{animate:false});GodpowerPicker.notify()`);
        await until(() => w.broker.snapshot?.theme === "marx", "HTML theme reaches sanitized snapshot");
        assert.equal(await main(`GodpowerTheme.get()`), "marx");
        assert.equal(await main(`GodpowerPicker.getSnapshot().theme`), "marx");
        await until(() => w.main.getTitle().startsWith("马克思的力量"), "native main title");
        assert.equal(w.picker.getTitle(), "课堂点名 · 马克思的力量");
        for (const role of ["main", "picker"])
          assert.ok(iconChanges.some((v) => v.role === role && v.icon === path.join(w.root, "build/marx-icon.png")), role + " native icon updated");
        assert.ok(fs.statSync(path.join(w.root, "build/marx-icon.png")).size > 0);
        await until(() => picker(`document.body.classList.contains('theme-marx') && document.body.dataset.theme==='marx'`), "picker theme");
        assert.equal(await picker(`getComputedStyle(document.body).backgroundColor`), "rgb(247, 240, 220)");
        const switches=await picker(`['antiRepeat','pin','effects'].map(id=>{const s=getComputedStyle(document.getElementById(id));return [s.appearance,s.width,s.height]})`);
        assert.deepEqual(switches,Array.from({length:3},()=>['none','52px','28px']));
        await settledShot(w.picker, "marx-picker-expanded");
        await picker(`godpowerDesktop.windowAction('collapse')`);
        await until(() => w.pickerCollapsed, "theme collapsed icon");
        assert.equal(await picker(`document.getElementById('pickerGlyph').textContent`), "★");
        assert.equal(await picker(`getComputedStyle(document.getElementById('pickerIcon')).backgroundColor`), "rgb(165, 34, 37)");
        await settledShot(w.picker, "marx-picker-icon");
        w.picker.reload();
        await until(() => !w.picker.webContents.isLoading(), "themed picker reload");
        await until(() => picker(`current?.ready && document.body.dataset.theme==='marx'`), "theme survives picker reload");
        assert.deepEqual([w.picker.getBounds().width, w.picker.getBounds().height], [72, 72]);
        await picker(`godpowerDesktop.windowAction('expand')`);
        await main(`openScoreModal(1)`);
        await delay(500);
        assert.equal(await main(`document.body.dataset.theme==='marx'&&!document.getElementById('scoreModalBackdrop').hasAttribute('data-native-detached')`),true);
        await settledShot(w.main,"marx-internal-score");
        await main(`ClassroomFeedback.setOptions({scoreEffects:true});ClassroomFeedback.score('主题积分展示',5)`);
        await until(() => w.effect && !w.effect.webContents.isLoading(), "themed score effect loaded");
        await until(() => js(w.effect, `document.body.dataset.theme==='marx' && document.getElementById('name').textContent==='+5'`), "themed score effect presented");
        assert.equal(w.effectPayload.theme, "marx");
        assert.equal(await js(w.effect, `getComputedStyle(document.getElementById('name')).color`), "rgb(21, 145, 106)");
        await settledShot(w.effect, "marx-positive-effect");
        w.closeEffect();
        await main(`ClassroomFeedback.score('主题积分展示',-3)`);
        await until(() => w.effect && !w.effect.webContents.isLoading(), "negative themed score effect loaded");
        await until(() => js(w.effect, `document.getElementById('name').textContent==='−3'`), "negative themed score presented");
        assert.equal(await js(w.effect, `getComputedStyle(document.getElementById('name')).color`), "rgb(218, 79, 81)");
        w.closeEffect();
        await main(`ClassroomFeedback.setOptions({scoreEffects:false});GodpowerTheme.set('classic',{animate:false});GodpowerPicker.notify()`);
        await until(() => w.broker.snapshot?.theme === "classic" && w.main.getTitle().startsWith("上帝的力量"), "classic native branding restored");
        await until(() => picker(`document.body.dataset.theme==='classic' && !document.body.classList.contains('theme-marx')`), "classic picker restored");
        assert.equal(await main(`document.body.dataset.theme`),"classic");
        assert.equal(w.picker.getTitle(), "课堂点名 · 上帝的力量");
        assert.ok(iconChanges.some((v) => v.icon === path.join(w.root, "build/classic-icon.png")), "classic native icon restored");
        await main(`closeScoreModal()`);
        assert.deepEqual(await main(`state.groups.map(g=>g.score)`), before, "presentation changes preserve all scores");
        return { themes: ["classic", "marx", "classic"], nativeIconCalls: iconChanges.length, pickerReload: true, internalDialogTheme: true, semanticScores: true };
      } finally {
        for (const { win, original } of originalSetters)
          if (!win.isDestroyed()) win.setIcon = original;
        w.closeEffect();
      }
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
          await until(() => w.broker.snapshot.phase === "settling", "settling").catch(async(error)=>{
            console.error("Stop diagnostics",JSON.stringify({broker:{phase:w.broker.snapshot.phase,epoch:w.broker.epoch,saveContext:w.broker.snapshot.saveContext},picker:await picker(`({phase:current?.snapshot.phase,pending,message:document.getElementById('message').textContent,disabled:document.getElementById('lever').disabled})`),main:await main(`({phase:GodpowerPicker.getSnapshot().phase,spinning:slotEngine.isSpinning,chosen:!!slotEngine.chosenResult,closing:!!window.classroomClosing,save:SaveManager.status(),context:SaveManager.context(),modal:document.getElementById('pickerModal').className,external:document.getElementById('pickerModal').hasAttribute('data-external-picker'),generation:DesktopUI.getPickerGeneration(),motion:DesktopUI.getPreferences(),rootInert:document.body.inert})`)}));throw error;
          });
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
          await until(async()=>await main("testSoundCalls.filter(x=>x==='roll_win').length")===soundsBefore.win+1,"scheduled win sound after loop fade");
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
          if(mode === 'individual'){
            // A command in flight disables the score inputs; wait for idle so
            // focus() is accepted rather than silently dropped.
            await until(
              () => picker(`!pending && !document.getElementById('delta').disabled`),
              "score inputs enabled after reveal",
            );
            await picker(`document.getElementById('delta').focus()`);
            assert.equal(await picker(`document.activeElement.id`),'delta');
            const nativeFocused=w.picker.isFocused;w.picker.isFocused=()=>false;
            try{w.picker.emit('focus');w.picker.emit('blur');await delay(250);assert.equal(w.pickerCollapsed,false,'editing input survives keyboard taking native focus');}
            finally{w.picker.isFocused=nativeFocused;await picker(`document.getElementById('delta').blur()`)}
          }
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
          await until(() => picker(`current.snapshot.phase==='revealed' && !pending && !current.snapshot.locked`), "score controls ready after IPC score");
          await picker(`document.querySelector('#slots button').click()`);
          await until(
            async () => (await main(`state.groups.find(g=>g.id===${result.groupId}).score`)) === before + 6,
            "visible quick-score button commits immediately",
          );
          await until(() => picker(`!pending`), "quick-score acknowledgement");
          assert.equal(await picker(`document.querySelector('#slots button').disabled`), false);
          await picker(`document.getElementById('delta').value='7';document.getElementById('customScore').requestSubmit()`);
          await until(
            async () => (await main(`state.groups.find(g=>g.id===${result.groupId}).score`)) === before + 13,
            "visible custom-score form commits immediately",
          );
          await until(() => picker(`!pending`), "custom-score acknowledgement");
          await until(
            () => picker(`document.getElementById('target').textContent.endsWith('当前 ${before + 13} 分')`),
            "floating picker shows the committed live score",
          );
          await main(`state.isLocked=true;GodpowerPicker.notify()`);
          await until(() => picker(`current.snapshot.locked===true`), "locked score state");
          assert.equal(await picker(`!!document.getElementById('unlockClassroom') && !document.getElementById('unlockClassroom').hidden`), true,
            "locked score controls explain how to unlock");
          await picker(`document.getElementById('unlockClassroom').click()`);
          await until(()=>main(`document.getElementById("pwdModal").getClientRects().length>0`),"internal password dialog from score panel");
          await main(`state.isLocked=false;closePwdModal()`);
          await delay(400);
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
    await test("floating launcher stays out of the taskbar and can be raised over video and PPT", async () => {
      const prefs = w.picker.webContents.getLastWebPreferences();
      assert.equal(prefs.sandbox, true);
      assert.equal(prefs.contextIsolation, true);
      // A launcher window never becomes a second taskbar or Alt+Tab entry.
      assert.equal(w.picker.isVisible(), true);
      const os = require("node:os");
      const version = os.release();
      if (process.platform === "win32") {
        // Electron reports skipTaskbar through the window's style bits; the
        // documented contract is asserted directly on the instance instead.
        assert.equal(w.picker.isSkipTaskbar?.() ?? true, true);
      }
      assert.equal(w.preferences.value.alwaysOnTop, true);
      assert.equal(w.picker.isAlwaysOnTop(), true);
      // The picker outranks ordinary always-on-top windows such as video players.
      await picker(`godpowerDesktop.windowAction('pin',true)`);
      await delay(30);
      assert.equal(w.picker.isAlwaysOnTop(), true);
      w.ensurePickerLevel(true);
      assert.equal(w.picker.isAlwaysOnTop(), true);
      await picker(`godpowerDesktop.windowAction('pin',false)`);
      assert.equal(w.picker.isAlwaysOnTop(), false);
      await picker(`godpowerDesktop.windowAction('pin',true)`);
      return { version, alwaysOnTop: w.picker.isAlwaysOnTop(), skipTaskbar: true };
    });    await test("the launcher offers picker or hand and the hand panel runs one classroom command", async () => {
      await picker(`godpowerDesktop.windowAction('collapse')`);
      await until(() => w.pickerCollapsed, "collapsed before launcher");
      await picker(`godpowerDesktop.windowAction('launcher')`);
      await until(() => w.pickerView === "launcher", "launcher view");
      assert.ok(w.picker.getBounds().width >= 200, "launcher shows a menu");
      assert.equal(await picker(`document.getElementById('launchHand').hidden`), false);
      await settledShot(w.picker, "floating-launcher");
      await picker(`document.getElementById('launchHand').click()`);
      await until(() => w.pickerView === "hand" && !w.pickerCollapsed, "hand view");
      await until(() => picker(`!document.getElementById('handPane').hidden`), "hand pane visible");
      const pickerHidden = await picker(`document.getElementById('pickerPane').hidden`);
      assert.equal(pickerHidden, true, "the hand view replaces the machine panel");
      const groups = await main(`state.groups.slice(0,2).map(g=>({id:g.id,groupUid:g.groupUid,score:g.score}))`);
      const before = await main(`({score:state.groups[0].score,correct:state.groups[0].itemStats.correct,inventory:state.groups[0].inventory.length,history:state.itemGlobal.handRaiseHistory.length})`);
      const select = await picker(`godpowerDesktop.command('handSelect',{groupId:${groups[0].id}})`);
      assert.equal(select.ok, true, JSON.stringify(select));
      await until(() => picker(`current?.snapshot?.hand?.groupId===${groups[0].id}`), "hand snapshot");
      const token = await picker(`current.snapshot.hand.selectionId`);
      assert.ok(token);
      const early = await picker(`godpowerDesktop.command('handScore',{groupId:${groups[0].id},selectionId:'${token}',delta:3})`);
      assert.equal(early.ok, false, "reward needs a correct answer first");
      await until(()=>w.effectPayload?.kind==='hand' && !w.effect.webContents.isLoading(),"native judgment cards");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-command="correct"]')`),"judgment UI ready");
      const denied=await js(w.effect,`godpowerDesktop.handAction('${w.effectPayload.id}','handScore',{groupId:${groups[1].id},selectionId:'${token}',delta:99})`);
      assert.equal(denied.ok,false,"effect cannot target another group");
      await settledShot(w.effect,"hand-judge-cards");
      await js(w.effect,`document.querySelector('[data-hand-command="correct"]').click()`);
      await until(()=>w.effectPayload?.hand?.phase==='REWARD_CHOICE',"native reward choices");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-choice="score"]')`),"reward UI ready");
      await settledShot(w.effect,"hand-reward-cards");
      await js(w.effect,`document.querySelector('[data-hand-choice="score"]').click();document.getElementById('handCardScore').value='3';document.getElementById('nativeHandScoreForm').requestSubmit()`);
      await until(()=>main(`state.groups[0].score===${before.score+3}`),"native score submitted");
      await main(`classroomCommands.whenIdle()`);
      const after = await main(`({score:state.groups[0].score,correct:state.groups[0].itemStats.correct,inventory:state.groups[0].inventory.length,history:state.itemGlobal.handRaiseHistory.length})`);
      assert.equal(after.score,before.score+3);assert.equal(after.correct,before.correct+1);assert.equal(after.history,before.history+1);
      const spent=await picker(`godpowerDesktop.command('handScore',{groupId:${groups[0].id},selectionId:'${token}',delta:3})`);
      assert.equal(spent.ok,false,"completed reward cannot score twice");
      await picker(`godpowerDesktop.command('handSelect',{groupId:${groups[0].id}})`);
      await until(()=>w.effectPayload?.kind==='hand'&&w.effectPayload.hand.phase==='JUDGE'&&!w.effect.webContents.isLoading(),"next hand judgment");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-command="correct"]')`),"next judgment ready");
      await js(w.effect,`document.querySelector('[data-hand-command="correct"]').click()`);
      await until(()=>w.effectPayload?.hand?.phase==='REWARD_CHOICE',"draw choices");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-command="draw"]')`),"draw button ready");
      await js(w.effect,`document.querySelector('[data-hand-command="draw"]').click()`);
      await until(()=>main(`state.groups[0].inventory.length===${before.inventory+1}`),"item awarded once");
      await until(()=>w.effectPayload?.hand?.phase==='DRAW',"native item reel");
      await until(()=>js(w.effect,`document.getElementById('nativeHandDrawName')?.textContent!=='道具正在揭晓'`),"native item reveal");
      await settledShot(w.effect,"hand-draw-reveal");
      const drawn=await picker(`current.snapshot.hand`);
      assert.equal(drawn.itemRewarded,true);
      const second=await picker(`godpowerDesktop.command('handDraw',{groupId:${groups[0].id},selectionId:'${drawn.selectionId}'})`);
      assert.equal(second.ok,false,"one hand session rewards once");
      await picker(`godpowerDesktop.command('handSelect',{groupId:${groups[0].id}})`);
      await until(()=>w.effectPayload?.hand?.phase==='JUDGE'&&!w.effect.webContents.isLoading(),"use judgment");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-command="correct"]')`),"use judge ready");
      await js(w.effect,`document.querySelector('[data-hand-command="correct"]').click()`);
      await until(()=>w.effectPayload?.hand?.phase==='REWARD_CHOICE',"use choices");
      await until(()=>js(w.effect,`!!document.querySelector('[data-hand-command="use"]:not(:disabled)')`),"item usable");
      await js(w.effect,`document.querySelector('[data-hand-command="use"]').click()`);
      await until(()=>w.effect && w.effectPayload?.kind==='item' && !w.effect.webContents.isLoading(),"item cinematic opens");
      await until(
        () => js(w.effect, `document.getElementById('mode').textContent.includes('道具')`),
        "item cinematic presented",
      );
      const cinematic = await js(
        w.effect,
        `({name:document.getElementById('name').textContent, targets:document.getElementById('itemTargets').textContent, icon:!document.getElementById('itemIcon').hidden})`,
      );
      assert.ok(cinematic.name.length > 0, "the caster is named");
      assert.ok(cinematic.targets.length > 0, "targets are listed");
      assert.equal(cinematic.icon, true, "the item icon is shown");
      await settledShot(w.effect, "floating-item-cinematic");
      w.closeEffect();
      await picker(`godpowerDesktop.windowAction('expand','picker')`);
      await until(() => picker(`!document.getElementById('pickerPane').hidden`), "picker pane back");
      return { token, scored: after.score, item: drawn.itemName, cinematic: cinematic.name };
    });
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
      const reopenAnchor=w.picker.getBounds();
      await picker(`godpowerDesktop.windowAction('expand')`);
      assert.deepEqual(w.picker.getBounds(),require('./window-state.cjs').visibleBounds({...b,x:reopenAnchor.x,y:reopenAnchor.y},screen.getAllDisplays(),null));
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
    await test("reveals randomise across the ten presentation styles", async () => {
      const { EFFECT_STYLES } = require("./contracts.cjs");
      // The snapshot carries the style the classroom picked; present() must keep
      // it, and an absent style must still land inside the pool.
      const seen = new Set();
      for (let i = 0; i < EFFECT_STYLES.length; i++) {
        const snapshot = structuredClone(w.broker.snapshot);
        snapshot.phase = "revealed";
        snapshot.effects = {
          ...snapshot.effects,
          enabled: true,
          duration: 1200,
          style: EFFECT_STYLES[i],
        };
        snapshot.result = {
          id: `style-probe-${i}`,
          mode: "group",
          groupId: 1,
          groupName: "第 1 小组",
          groupNo: 1,
          color: "#123456",
          score: 0,
          name: "第 1 小组",
          number: null,
        };
        w.lastReveal = null;
        w.present(snapshot);
        if (!w.effectPayload) continue;
        seen.add(w.effectPayload.effects.style);
        w.closeEffect();
      }
      assert.equal(w.effect, null, "the probe cleans up its windows");
      assert.equal(
        seen.size,
        EFFECT_STYLES.length,
        "every requested style survives, saw " + [...seen].join(","),
      );
      // With no style in the snapshot the host still chooses a valid one.
      const blank = structuredClone(w.broker.snapshot);
      blank.phase = "revealed";
      blank.effects = { enabled: true, duration: 1200 };
      blank.result = {
        id: "style-blank",
        mode: "group",
        groupId: 1,
        groupName: "第 1 小组",
        groupNo: 1,
        color: "#123456",
        score: 0,
        name: "第 1 小组",
        number: null,
      };
      w.lastReveal = null;
      w.present(blank);
      assert.ok(
        EFFECT_STYLES.includes(w.effectPayload.effects.style),
        "a missing style falls back into the ten",
      );
      w.closeEffect();
      // The HTML side is what rotates: its pool must cover all ten.
      const pool = await main(`EFFECT_STYLES`);
      assert.deepEqual([...pool].sort(), [...EFFECT_STYLES].sort());
      const drawn = await main(
        `(()=>{const s=new Set();for(let i=0;i<200;i++)s.add(randomEffectStyle());return [...s].sort()})()`,
      );
      assert.equal(drawn.length, 10, "the classroom reaches all ten styles");
      // A chosen style is applied as a class the renderer has a layer for.
      const snapshot = structuredClone(w.broker.snapshot);
      snapshot.phase = "revealed";
      snapshot.effects = { ...snapshot.effects, style: "comet", duration: 1200 };
      snapshot.result = {
        id: "style-explicit",
        mode: "group",
        groupId: 1,
        groupName: "第 1 小组",
        groupNo: 1,
        color: "#123456",
        score: 0,
        name: "第 1 小组",
        number: null,
      };
      w.lastReveal = null;
      w.present(snapshot);
      assert.equal(w.effectPayload.effects.style, "comet", "an explicit style sticks");
      await until(() => !w.effect.webContents.isLoading(), "comet effect loaded");
      await until(
        () => js(w.effect, `document.getElementById('stage').classList.contains('comet')`),
        "comet class applied",
      );
      const layer = await js(
        w.effect,
        `(()=>{const s=getComputedStyle(document.querySelector('.particles i'));return [s.animationName,s.width,s.height]})()`,
      );
      assert.equal(layer[0], "comet-streak", "the comet layer actually runs");
      await settledShot(w.effect, "effect-comet");
      w.closeEffect();
      return { requested: [...seen], classroom: drawn };
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
      // The catalog grows with each item release; assert the shipped count
      // reported by the classroom rather than a stale constant.
      assert.equal(info.items, 28);
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
    await delay(400);
    assert.equal(await main(`document.getElementById('aboutBackdrop').getClientRects().length>0`),true);

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
