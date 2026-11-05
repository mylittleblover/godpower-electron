import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const assets=Object.fromEntries(await Promise.all(['hand-cards.js','hand-cards.css','effect.css'].map(async f=>[f,await readFile('renderer/'+f)])));
const server=createServer((req,res)=>{
 const key=req.url.slice(1);if(assets[key]){res.setHeader('Content-Type',key.endsWith('.css')?'text/css':'text/javascript');res.end(assets[key]);return}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<link rel="stylesheet" href="effect.css"><link rel="stylesheet" href="hand-cards.css"><div id="stage"><section id="handCards" class="hand-cards" hidden></section></div><script>const stage=document.getElementById("stage");window.godpowerDesktop={handAction:async()=>({ok:true}),interactive(){}}</script><script src="hand-cards.js"></script>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.deepEqual(errors,[],"native hand surface script must load");
 const stable=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);
  const image=canvas.toDataURL('image/webp');
  window.payload={id:'hand-s',kind:'hand',group:{id:1,groupNo:7,name:'自定义小组'},slots:[1,2,3,-1,-2,-3],hand:{groupId:1,selectionId:'s',phase:'JUDGE',avatarDataUrl:image,motionEnabled:true}};
  HandCards.render(payload,()=>window.exited=true);
  const button=document.querySelector('[data-hand-command="correct"]');
  const initiallyDisabled=button.disabled;
  HandCards.render({...payload,hand:{...payload.hand,busy:true}},()=>window.exited=true);
  return {initiallyDisabled,same:button===document.querySelector('[data-hand-command="correct"]'),disabled:document.querySelector('[data-hand-command="correct"]').disabled};
 });
 assert.deepEqual(stable,{initiallyDisabled:false,same:true,disabled:true},'busy snapshot must not recreate and replay card entrance');
 assert.match(await page.locator('[data-hand-close]').innerText(),/退出举手/);
 assert.equal(await page.locator('.hand-group-avatar').count(),1);
 await page.evaluate(()=>HandCards.render({...payload,hand:{...payload.hand,phase:'DRAW',itemName:'金币',itemIcon:payload.hand.avatarDataUrl}},()=>window.exited=true));
 await page.waitForFunction(()=>document.querySelector('.native-hand-reel img')?.complete&&document.querySelector('.native-hand-reel img').naturalWidth>0);
 assert.equal(await page.locator('#nativeHandDrawName').innerText(),'金币');
 await mkdir('artifacts/hand-surface',{recursive:true});await page.screenshot({path:'artifacts/hand-surface/draw.png'});
 await page.locator('[data-hand-close]').click();assert.equal(await page.evaluate(()=>window.exited),true);
 assert.deepEqual(errors,[]);await writeFile('artifacts/hand-surface/result.json',JSON.stringify({status:'PASS',stable,errors},null,2));
 console.log('PASS native hand busy DOM reuse, explicit exit, avatar and real drawn item image');
}finally{await browser.close();server.close()}
