'use strict';
/* Fixed public RSS endpoint. Result pages are never fetched or executed. */
const MAX_BYTES=512*1024;
function decode(value){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,e=>{const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(names[e.toLowerCase()])return names[e.toLowerCase()];const n=e[2].toLowerCase()==='x'?parseInt(e.slice(3),16):parseInt(e.slice(2),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/<[^<>]*>/g,'').replace(/\s+/g,' ').trim();}
function safeLink(value){if(typeof value!=='string'||value.length>2000)return null;try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!u.hostname.includes('.')||/[\[\]:]/.test(u.hostname)||/^\d+(?:\.\d+){3}$/.test(u.hostname)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname))return null;return u.href;}catch{return null;}}
function parseResults(xml){
 if(typeof xml!=='string'||xml.length>MAX_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/^\s*(?:<\?xml[^>]*>\s*)?<rss\b/i.test(xml)||!/<\/rss>\s*$/i.test(xml))throw Error('搜索响应格式无效');
 if((xml.match(/<item\b/gi)||[]).length>50)throw Error('搜索结果数量超出限制');
 const results=[],seen=new Set();
 for(const item of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const field=name=>decode(item[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]||'');
  const url=safeLink(field('link')),title=field('title').slice(0,200),text=field('description').slice(0,1600);
  if(!url||!title||seen.has(url))continue;seen.add(url);results.push({id:'W'+(results.length+1),title,text,url,kind:'web-snippet',retrievedAt:new Date().toISOString()});if(results.length===5)break;
 }
 return results;
}
function relevant(results,query){
 const terms=(query.replace(/site:[^\s]+/gi,'').toLowerCase().match(/[a-z0-9]{3,}|[\u3400-\u9fff]{2,}/g)||[]).flatMap(t=>/[\u3400-\u9fff]/.test(t)?Array.from({length:t.length-1},(_,i)=>t.slice(i,i+2)):[t]);
 const site=query.match(/site:([a-z0-9.-]+)/i)?.[1].toLowerCase();
 return results.filter(r=>{const host=new URL(r.url).hostname;return /(?:^|\.)(?:edu\.cn|gov\.cn|ac\.cn|edu|gov|smartedu\.cn|pep\.com\.cn|wikipedia\.org|openstax\.org|khanacademy\.org)$/.test(host)&&(!terms.length||terms.some(t=>(r.title+' '+r.text).toLowerCase().includes(t)))&&(!site||new URL(r.url).hostname===site||new URL(r.url).hostname.endsWith('.'+site));});
}
async function readBounded(response,signal){
 if(!response.ok)throw Error('搜索服务暂不可用');
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('搜索结果超出限制');
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw Error('搜索结果超出限制');text+=decoder.decode(value,{stream:true});}}finally{await reader.cancel().catch(()=>{});}
 signal.throwIfAborted();return text+decoder.decode();
}
async function searchWeb(query,{signal,fetch:fetchImpl=globalThis.fetch}={}){
 if(typeof query!=='string'||!query.trim()||query.length>300)throw Error('联网关键词需为1至300字');
 const abort=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(10000)]);abort.throwIfAborted();
 const url=new URL('https://www.bing.com/search');url.searchParams.set('format','rss');url.searchParams.set('q',query.trim());
 const options={redirect:'error',headers:{Accept:'application/rss+xml, application/xml, application/json, text/xml','Accept-Language':'zh-CN,zh;q=0.9','User-Agent':'GodPowerClassroom/3.0 (https://github.com/mylittleblover/godpower-electron)'}};
 try{
   const response=await fetchImpl(url.href,{...options,signal:AbortSignal.any([abort,AbortSignal.timeout(4500)])});
   const results=relevant(parseResults(await readBounded(response,abort)),query);if(results.length)return results.map((r,i)=>({...r,id:'W'+(i+1)}));
 }catch(error){if(abort.aborted)throw error;}
 abort.throwIfAborted();
 // Fallback is explicitly an encyclopedia search, not a full web/textbook source.
 const wiki=new URL('https://zh.wikipedia.org/w/api.php');for(const [k,v] of Object.entries({action:'query',list:'search',format:'json',srlimit:'5',srsearch:query.trim()}))wiki.searchParams.set(k,v);
 const text=await readBounded(await fetchImpl(wiki.href,{...options,signal:abort}),abort),data=JSON.parse(text);
 if(!Array.isArray(data?.query?.search))throw Error('百科检索响应格式无效');
 const results=relevant(data.query.search.slice(0,5).filter(r=>typeof r.title==='string'&&typeof r.snippet==='string'&&Number.isSafeInteger(r.pageid)&&r.pageid>0).map((r,i)=>({id:'W'+(i+1),title:decode(r.title).slice(0,200),text:decode(r.snippet).slice(0,1600),url:'https://zh.wikipedia.org/?curid='+r.pageid,kind:'encyclopedia-snippet',retrievedAt:new Date().toISOString()})),query);
 if(!results.length)throw Error('搜索未返回相关结果，请更换关键词或稍后再试');return results;
}
module.exports={searchWeb,parseResults,safeLink};
