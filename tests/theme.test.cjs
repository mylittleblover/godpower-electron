const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { sanitizeSnapshot } = require('../desktop/contracts.cjs');
const base = { protocolVersion: 1, phase: 'idle', mode: 'individual', groups: [], slots: [1,2,3,-1,-2,-3], history: [] };
test('snapshot theme is strictly whitelisted and old snapshots default to classic', () => {
  assert.equal(sanitizeSnapshot({...base, theme:'marx'}).theme, 'marx');
  for (const theme of [undefined, 'classic', 'MARX', {}, ['marx'], 'marx evil'])
    assert.equal(sanitizeSnapshot({...base, theme}).theme, 'classic');
});
function renderer(file) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, { dataset:{}, style:{values:{},setProperty(k,v){this.values[k]=v;}}, classList:{values:new Set(),add(...v){v.forEach(x=>this.values.add(x));},toggle(k,v){v?this.values.add(k):this.values.delete(k);}}, children:[], hidden:true, addEventListener(){}, setAttribute(){}, removeAttribute(){}, replaceChildren(){}, querySelectorAll(){return [];}, querySelector(){return get('button');}, append(){} });
    return nodes.get(id);
  };
  const api = { onReveal(fn){this.reveal=fn;}, onState(fn){this.state=fn;}, getState(){return Promise.resolve(null);}, ready(){} };
  const document = {body:get('body'), getElementById:get, createElement:()=>get('new'), querySelectorAll:()=>[]};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer',file),'utf8'), {window:{godpowerDesktop:api,addEventListener(){}},document,setTimeout:()=>1,clearTimeout(){},confirm:()=>false});
  return {api,get,document};
}
test('picker applies Marx branding from its snapshot and resets on legacy snapshots', () => {
  const {api,get,document} = renderer('picker.js');
  const state = {revision:1,ready:true,snapshot:{...base,theme:'marx',preview:{},groups:[],preselectedGroupIds:[],history:[],result:null},shell:{collapsed:true,displays:[]}};
  api.state(state);
  assert.equal(document.body.dataset.theme,'marx');
  assert.equal(document.body.classList.values.has('theme-marx'),true);
  assert.equal(get('pickerGlyph').textContent,'★');
  api.state({...state,revision:2,snapshot:{...state.snapshot,theme:undefined}});
  assert.equal(document.body.dataset.theme,'classic');
  assert.equal(get('pickerGlyph').textContent,'✦');
});
test('effect theme leaves score colors semantic and uses gold for Marx picker reveal', () => {
  for (const [mode,color,expected] of [['score','#15916a','#15916a'],['score','#da4f51','#da4f51'],['individual','#123456','#d6ad58']]) {
    const {api,get,document} = renderer('effect.js');
    api.reveal({id:'r',theme:'marx',result:{mode,color,name:'甲',groupName:'一组',number:null},effects:{style:'aurora',duration:1200}});
    assert.equal(document.body.classList.values.has('theme-marx'),true);
    assert.equal(get('stage').style.values['--group'],expected);
  }
});
test('full-screen reveal displays only bounded local WebP avatar data', () => {
  const {api,get} = renderer('effect.js');
  api.reveal({id:'avatar',theme:'classic',result:{mode:'individual',color:'#123456',name:'甲',groupName:'一组',number:null,avatarDataUrl:'data:image/webp;base64,QUJD'},effects:{style:'aurora',duration:1200}});
  assert.equal(get('avatar').src,'data:image/webp;base64,QUJD');
  assert.equal(get('avatarFrame').hidden,false);
  const second = renderer('effect.js');
  second.api.reveal({id:'plain',theme:'classic',result:{mode:'group',color:'#123456',name:'一组',groupName:'一组',number:null,avatarDataUrl:''},effects:{style:'aurora',duration:1200}});
  assert.equal(second.get('avatarFrame').hidden,true);
});
test('native branding uses local icon and classic remains the fallback', () => {
  const { branding } = require('../desktop/theme.cjs');
  assert.equal(branding('marx').title,'马克思的力量');
  assert.equal(branding('marx').icon,'build/marx-icon.png');
  assert.equal(branding('anything').title,'上帝的力量');
  assert.equal(branding('classic').icon, 'build/classic-icon.png');
});
function windowsClass() {
  const { createRequire } = require('node:module');
  const filename = path.join(__dirname, '../desktop/windows.cjs');
  const localRequire = createRequire(filename);
  const output = {exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'), {require(name){return name==='electron'? {}:localRequire(name);},module:output,exports:output.exports, __dirname:path.dirname(filename)});
  return output.exports.Windows;
}
test('native branding updates open main and picker windows and notifies tray once', () => {
  const {Windows} = {Windows:windowsClass()};
  const changes = [];
  const win = role => ({isDestroyed:()=>false,setTitle(v){changes.push([role,'title',v]);},setIcon(v){changes.push([role,'icon',v]);},setBackgroundColor(v){changes.push([role,'background',v]);}});
  const owner = {root:'/app',main:win('main'),picker:win('picker'),broker:{snapshot:{theme:'marx'}},onThemeChange(v){changes.push(['tray',v.title]);}};
  Windows.prototype.updateBranding.call(owner);
  assert.ok(changes.some(v=>v[0]==='main'&&v[2]==='马克思的力量'));
  assert.ok(changes.some(v=>v[0]==='picker'&&v[2]==='课堂点名 · 马克思的力量'));
  assert.ok(changes.some(v=>v[0]==='main'&&v[2]==='/app/build/marx-icon.png'));
  const count = changes.length;
  Windows.prototype.updateBranding.call(owner);
  assert.equal(changes.length,count);
  owner.broker.snapshot = null;
  Windows.prototype.updateBranding.call(owner);
  assert.ok(changes.some(v=>v[0]==='main'&&v[2]==='上帝的力量'));
});
