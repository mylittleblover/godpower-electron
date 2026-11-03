const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  vm = require("node:vm");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
test("quitting waits for accepted disk writes before closing windows", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-quit-"));
  const filename = path.resolve("desktop/windows.cjs"),
    localRequire = createRequire(filename),
    handlers = {};
  let quitCalls = 0,
    prevented = 0,
    closed = 0;
  const app = {
    getPath: () => dir,
    on: (name, fn) => {
      handlers[name] = fn;
    },
    quit: () => {
      quitCalls++;
      handlers["before-quit"]({ preventDefault: () => prevented++ });
    },
  };
  const electron = { app, screen: { on() {} }, globalShortcut: {} };
  const output = { exports: {} };
  const source = process.env.SAVE_LIFECYCLE_BASELINE
    ? execFileSync(
        "git",
        ["show", process.env.SAVE_LIFECYCLE_BASELINE + ":desktop/windows.cjs"],
        { encoding: "utf8" },
      )
    : fs.readFileSync(filename, "utf8");
  vm.runInNewContext(source, {
    require: (name) => (name === "electron" ? electron : localRequire(name)),
    module: output,
    __dirname: path.dirname(filename),
    console,
  });
  const { Windows } = output.exports;
  Windows.prototype.installIPC = () => {};
  Windows.prototype.savePicker = () => {};
  Windows.prototype.closeEffect = () => closed++;
  const windows = new Windows(dir);
  try {
    const writing = windows.saveFile.write({
      schemaVersion: 2,
      pad: "x".repeat(1024 * 1024),
    });
    handlers["before-quit"]({ preventDefault: () => prevented++ });
    assert.equal(prevented, 1);
    assert.equal(closed, 0);
    assert.equal((await writing).ok, true);
    await windows.saveFile.whenIdle();
    await Promise.resolve();
    assert.equal(quitCalls, 1);
    assert.equal(closed, 1);
    assert.equal(windows.saveFile.pendingWrites, 0);
    assert.equal(windows.saveFile.read().data.pad.length, 1024 * 1024);
  } finally {
    await windows.saveFile.whenIdle();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('quit waits for renderer confirmation even before native pendingWrites increases',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-renderer-quit-')),handlers={},sent=[];
 let quits=0,prevented=0,closed=0;
 const app={getPath:()=>dir,on:(name,fn)=>handlers[name]=fn,quit:()=>{quits++;handlers['before-quit']({preventDefault:()=>prevented++});}};
 const electron={app,screen:{on(){}},globalShortcut:{}};const filename=path.resolve('desktop/windows.cjs'),localRequire=createRequire(filename),output={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:name=>name==='electron'?electron:localRequire(name),module:output,__dirname:path.dirname(filename),console});
 const {Windows}=output.exports;Windows.prototype.installIPC=()=>{};Windows.prototype.savePicker=()=>{};Windows.prototype.closeEffect=()=>closed++;
 const windows=new Windows(dir);windows.main={isDestroyed:()=>false,webContents:{send:(channel,value)=>sent.push({channel,value})}};windows.broker.ready=true;
 try{
  assert.equal(windows.saveFile.pendingWrites,0);handlers['before-quit']({preventDefault:()=>prevented++});assert.equal(prevented,1);assert.equal(quits,0);assert.equal(closed,0);assert.equal(sent[0].channel,'gp:save-flush');
  windows.saveFlush.reply({id:sent[0].value.id,ok:true});await new Promise(setImmediate);assert.equal(quits,1);assert.equal(closed,1);
 }finally{await windows.saveFile.whenIdle();fs.rmSync(dir,{recursive:true,force:true});}
});
