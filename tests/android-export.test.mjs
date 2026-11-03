import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('../android/app/src/main/assets/download.js',import.meta.url),'utf8');
function fixture(bytes,{cancel=false}={}){
 const calls=[],alerts=[],events={};let fetches=0;const bridge={postMessage:raw=>{const m=JSON.parse(raw);calls.push(m);const type=m.type==='begin'?(cancel?'cancel':'ready'):m.type==='end'?'done':'ack';queueMicrotask(()=>bridge.onmessage({data:JSON.stringify({id:m.id,type})}));}};
 const ctx={window:{LanmaoFiles:bridge},document:{addEventListener:(name,fn)=>events[name]=fn},fetch:async()=>{fetches++;return {blob:async()=>new Blob([bytes])};},Blob,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),setTimeout,clearTimeout,alert:s=>alerts.push(s)};
 vm.runInNewContext(code,ctx);return {ctx,calls,alerts,events,get fetches(){return fetches;}};
}
const url='blob:https://lanmaospace.pages.dev/test';
test('安卓导出分块重建与原文件逐字节一致，完成后才结束',async()=>{const bytes=Buffer.from(Array.from({length:140000},(_,i)=>i%256));const f=fixture(bytes);f.events.click({target:{closest:()=>({href:url,download:'example.json'})}});await f.ctx.window.LanmaoExport.start(url);assert.equal(f.calls[0].name,'example.json');const chunks=f.calls.filter(x=>x.type==='chunk');assert.equal(chunks.length,3);assert.deepEqual(Buffer.concat(chunks.map(x=>Buffer.from(x.data,'base64'))),bytes);assert.deepEqual(chunks.map(x=>x.offset),[0,65536,131072]);assert.equal(f.calls.at(-1).type,'end');assert.equal(f.alerts.length,0);});
test('取消选择保存位置不发送任何文件分块',async()=>{const f=fixture(Buffer.from('private'),{cancel:true});await f.ctx.window.LanmaoExport.start(url);assert(!f.calls.some(x=>x.type==='chunk'));assert(!f.calls.some(x=>x.type==='end'));assert.equal(f.alerts.length,0);});
test('拒绝其他网站的blob，不读取或发送文件',async()=>{const f=fixture(Buffer.from('test'));await f.ctx.window.LanmaoExport.start('blob:https://example.com/file');assert.equal(f.fetches,0);assert.equal(f.calls.length,0);});
test('同一时刻仅允许一个导出，空文件也能正确结束',async()=>{const f=fixture(Buffer.alloc(0));await Promise.all([f.ctx.window.LanmaoExport.start(url),f.ctx.window.LanmaoExport.start(url)]);assert.equal(f.fetches,1);assert.deepEqual(f.calls.map(x=>x.type),['begin','end']);});
