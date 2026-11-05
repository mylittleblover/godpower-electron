const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
function fixture(){
 let created=0;const filename=path.resolve('desktop/windows.cjs'),requireLocal=createRequire(filename),out={exports:{}};
 class Window {constructor(){created++;this.webContents={on(){},isLoading:()=>false,send(){}}}on(){}setAlwaysOnTop(){}setVisibleOnAllWorkspaces(){}setIgnoreMouseEvents(){}loadURL(){return Promise.resolve()}isDestroyed(){return false}}
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:out,require:n=>n==='electron'?{BrowserWindow:Window}:requireLocal(n),__dirname:path.dirname(filename),console,setTimeout:()=>0,clearTimeout(){},clearInterval(){}});
 const w=Object.create(out.exports.Windows.prototype),handWindow={isDestroyed:()=>false};
 Object.assign(w,{effect:handWindow,effectPayload:{kind:'hand',id:'hand-s'},nativeHandActive:true,broker:{snapshot:{phase:'idle',saveContext:{saveId:'save-A',generation:1}}},preferences:{value:{effectsEnabled:true}},escape:{release(){}},broadcast(){},secure(){},preferencesFor:()=>({}),targetDisplay:()=>({bounds:{x:0,y:0,width:1920,height:1080}})});
 return {w,handWindow,created:()=>created};
}
function score(){return{phase:'revealed',effects:{enabled:true,duration:1200},result:{id:'score-1',mode:'score',name:'+3'}}}
test('secondary feedback cannot destroy the active hand window and resumes after its owner exits',()=>{
 const {w,handWindow,created}=fixture();
 w.present(score());assert.equal(w.effect,handWindow,'active hand window must survive unrelated score');assert.equal(created(),0);
 w.nativeHandActive=false;w.effect=null;w.effectPayload=null;w.flushFeedback();assert.equal(created(),1);
});
test('feedback during a rolling picker waits and never crosses a save generation',()=>{
 const {w,created}=fixture();w.effect=null;w.effectPayload=null;w.nativeHandActive=false;w.broker.snapshot.phase='rolling';
 w.present(score());assert.equal(created(),0);w.broker.snapshot.phase='idle';w.broker.snapshot.saveContext.generation++;
 w.flushFeedback();assert.equal(created(),0,'deferred presentation from another save must be dropped');
});
