import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const core=await import(pathToFileURL(root+'/memo-core.mjs'));
const salt=new Uint8Array(16).fill(7), password='local-fixture-only';
const testKey=await core.deriveKey(password,salt);
const sample={title:'测试标题',body:'私密正文 <script>',tags:['实验','实验','计划'],pinned:true,trashedAt:null};
const id='12345678-1234-4234-8234-123456789abc';
async function archive(records) {
    const chunks=[];const writer=await core.backupWriter({async write(b){chunks.push(b);}},testKey,core.b64(salt),id);
    for(const r of records)await writer.record(r);
    return new Blob(chunks);
}
const records=[{kind:'manifest',notes:[{id:'n1',note:sample}],files:[{id:'f1',note_id:'n1',name:'测试.png',size:4,type:'image/png'}]},
    {kind:'file',id:'f1',data:core.b64(new Uint8Array([0,1,2,255]))},{kind:'end',notes:1,files:1}];
test('旧格式兼容，标签去重，完整加密字段往返',async()=>{
    const row=await core.seal(testKey,sample);assert(!row.ciphertext.includes('私密'));
    assert.deepEqual(core.normalizeNote(await core.open(testKey,row)),{...sample,tags:['实验','计划']});
    assert.deepEqual(core.normalizeNote({title:'old',body:'body'}),{title:'old',body:'body',tags:[],pinned:false,trashedAt:null});
});
test('错误口令不能解密',async()=>{const row=await core.seal(testKey,sample);await assert.rejects(core.open(await core.deriveKey('wrong',salt),row));});
test('完整备份逐段校验并包含正文和附件',async()=>{
    const f=await archive(records),h=await core.backupHeader(f);const manifest=await core.inspectBackup(f,testKey,h);
    assert.equal(manifest.notes[0].note.body,sample.body);assert.equal(manifest.files[0].name,'测试.png');
    assert(!(await f.text()).includes('测试标题'));
});
test('备份截断、损坏、错口令均拒绝',async()=>{
    const f=await archive(records),h=await core.backupHeader(f);
    await assert.rejects(core.inspectBackup(f.slice(0,f.size-1),testKey,h));
    const bad=new Uint8Array(await f.arrayBuffer());bad[bad.length-20]^=1;
    await assert.rejects(core.inspectBackup(new Blob([bad]),testKey,h));
    await assert.rejects(core.inspectBackup(f,await core.deriveKey('wrong',salt),h));
});
test('缺失结束段、重复附件、缺附件、无效关联均拒绝',async()=>{
    for(const list of [records.slice(0,2),[records[0],records[1],records[1],records[2]],[records[0],records[2]],
        [{...records[0],files:[{...records[0].files[0],note_id:'missing'}]},records[1],records[2]]]) {
        const f=await archive(list);await assert.rejects(core.inspectBackup(f,testKey,await core.backupHeader(f)));
    }
});
test('重复恢复 ID 稳定，按用户与备份隔离',async()=>{
    const a=await core.restoreId(id,'owner','note','n1');assert.equal(a,await core.restoreId(id,'owner','note','n1'));
    assert.notEqual(a,await core.restoreId(id,'other','note','n1'));assert.notEqual(a,await core.restoreId(id,'owner','file','n1'));
});

class Element {
    constructor(id=''){this.id=id;this.value='';this.hidden=false;this.checked=false;this.disabled=false;this.children=[];this.files=[];this.listeners={};this.attrs={};this.textContent='';}
    append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
    addEventListener(name,fn){this.listeners[name]=fn;} querySelectorAll(){return [];}
    setAttribute(k,v){this.attrs[k]=v;}hasAttribute(k){return Object.hasOwn(this.attrs,k);}removeAttribute(k){delete this.attrs[k];}
    reset(){}focus(){}close(){this.open=false;}showModal(){this.open=true;}click(){this.clicked=true;}remove(){}
}
function context(options={}) {
    const elements=new Map(),calls=[],events={};
    const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
    const document={getElementById:get,createElement:()=>new Element(),body:new Element(),addEventListener:(e,fn)=>events[e]=fn};
    const tables={memos:[],memo_files:[]};
    const client={from(table){
        let action='select',body,filters=[];
        const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(){return q;},maybeSingle(){q.single=true;return q;},
            update(v){action='update';body=v;return q;},insert(v){action='insert';body=v;return q;},upsert(v){action='upsert';body=v;return q;},delete(){action='delete';return q;},
            then(resolve,reject){
                calls.push({table,action,filters,body});let data=[];
                if(options.failTable===table)return Promise.resolve({data:null,error:Error('offline')}).then(resolve,reject);
                if(action==='insert'||action==='upsert') {
                    if(!tables[table].some(x=>x.id===body.id))tables[table].push({...body,created_at:'2026-01-01',updated_at:'2026-01-01'});
                    data=tables[table].filter(x=>x.id===body.id);
                } else {
                    data=tables[table].filter(x=>filters.every(([k,v])=>x[k]===v));
                    if(action==='update')data.forEach(x=>Object.assign(x,body));
                    if(action==='delete')tables[table]=tables[table].filter(x=>!data.includes(x));
                }
                if(q.single)data=data[0]||null;
                return Promise.resolve({data,error:null}).then(resolve,reject);
            }
        };return q;
    },storage:{from(){return{remove:async()=>({error:null})};}}};
    const ctx=vm.createContext({...core,crypto,TextEncoder,TextDecoder,Uint8Array,Blob,File,URL,Map,Set,WeakMap,Date,Error,Number,JSON,Math,console:{error(){}},document,
        window:{LANMAO_MEMO_CONFIG:{ownerEmail:'fixture@example.invalid'},confirm:()=>options.confirm!==false,addEventListener:(e,fn)=>events[e]=fn},
        setTimeout:()=>0,setInterval:()=>0,XMLHttpRequest:class{},fixtureKey:testKey,fixtureClient:client,fixtureSalt:core.b64(salt)});
    let source=readFileSync(root+'/memo.js','utf8').replace(/^import[\s\S]*?from '\.\/memo-core.mjs';/,'').replace(/\ninit\(\);\s*$/,'');
    vm.runInContext(source,ctx);vm.runInContext("client=fixtureClient;user={id:'owner'};key=fixtureKey;vault={salt:fixtureSalt};operationEpoch=generation;show('app-panel');clearEditor();",ctx);
    return {ctx,get,calls,events,tables,run:code=>vm.runInContext(code,ctx)};
}
test('未保存提醒：编辑、新增附件、取消和离开保护',()=>{
    const h=context({confirm:false});h.run('openEditor(null)');assert.equal(h.run('dirty()'),false);
    h.get('note-body').value='draft';assert.equal(h.run('dirty()'),true);assert.equal(h.run('canLeave()'),false);
    let blocked=false;h.events.beforeunload({preventDefault(){blocked=true;}});assert(blocked);
    h.get('note-body').value='';h.run("pending=[new File(['x'],'x.txt')]");assert.equal(h.run('dirty()'),true);
});
test('下载链接不会被未保存提醒拦截，普通离站链接仍被阻止',()=>{
    const h=context({confirm:false});h.run('busy=true');let prevented=false;
    const a=new Element();a.attrs.download='file';
    h.events.click({target:{closest:()=>a},preventDefault(){prevented=true;}});assert.equal(prevented,false);
    delete a.attrs.download;h.events.click({target:{closest:()=>a},preventDefault(){prevented=true;}});assert(prevented);
});
test('跨设备更新必须匹配密文版本，过期更新拒绝且不覆盖',async()=>{
    const h=context();const cipher=await core.seal(testKey,sample);const row={id:'n',user_id:'owner',...cipher,created_at:'2026',updated_at:'2026'};h.tables.memos.push(row);
    h.ctx.row={...row,note:sample};h.ctx.changed={...sample,body:'latest'};
    const updated=await h.run('writeNote(row,changed)');assert.notEqual(updated.ciphertext,cipher.ciphertext);
    await assert.rejects(h.run('writeNote(row,changed)'),/另一台设备/);
    assert(h.calls.some(c=>c.action==='update'&&c.filters.some(([k])=>k==='ciphertext')));
    assert.equal((await core.open(testKey,h.tables.memos[0])).body,'latest');
});
test('回收站和置顶状态都在加密载荷中',async()=>{
    const h=context();h.ctx.value={...sample,pinned:true,trashedAt:'2026-11-01T00:00:00Z'};
    const row=await h.run('writeNote(null,value)');const stored=h.tables.memos[0];
    assert.equal(stored.pinned,undefined);assert.equal(stored.trashedAt,undefined);
    assert.equal((await core.open(testKey,stored)).trashedAt,'2026-11-01T00:00:00Z');assert(row.note.pinned);
});
test('自动锁定保留加密草稿和待上传文件，清除 DOM 与密钥',async()=>{
    const h=context();h.run("openEditor(null);pending=[new File(['draft-file'],'note.txt')]");h.get('note-body').value='unsaved-secret';
    h.run("prepareUnlock=async()=>{};");await h.run('lockVault(true)');
    assert.equal(h.run('key'),null);assert.equal(h.run('notes.length'),0);assert.equal(h.run('pending.length'),0);
    const draft=await core.open(testKey,h.run('sealedDraft'));assert.equal(draft.note.body,'unsaved-secret');assert.equal(draft.files[0].name,'note.txt');
    assert(!JSON.stringify(h.run('sealedDraft')).includes('unsaved-secret'));assert(h.get('editor-form').hidden);
});
test('锁定后阻止迟到下载和更新',async()=>{
    const h=context();h.run('wipe()');assert.throws(()=>h.run("downloadBlob(new Blob(['x']),'file')"),/已锁定/);
});
test('一次恢复创建副本，再恢复同一备份不会重复创建或覆盖已有副本',async()=>{
    const h=context(), f=await archive([{kind:'manifest',notes:[{id:'n1',note:sample}],files:[]},{kind:'end',notes:1,files:0}]);
    const info=await core.backupHeader(f),manifest=await core.inspectBackup(f,testKey,info);
    h.ctx.fixtureBackup=f;h.ctx.fixtureInfo=info;h.ctx.fixtureManifest=manifest;
    const setup="backupFile=fixtureBackup;backupKey=fixtureKey;backupInfo=fixtureInfo;backupManifest=fixtureManifest;";
    h.run(setup);await h.run('restoreBackup()');assert.equal(h.tables.memos.length,1);
    const first=h.tables.memos[0].ciphertext;
    h.run(setup);await h.run('restoreBackup()');assert.equal(h.tables.memos.length,1);assert.equal(h.tables.memos[0].ciphertext,first);
});
test('正文保存成功但附件失败时保留待上传文件，重试不重复创建正文',async()=>{
    const h=context();h.run("openEditor(null);pending=[new File(['payload'],'retry.txt')];uploadFile=async()=>{throw Error('offline')};");
    h.get('note-body').value='saved body';await h.run('save()');
    assert.equal(h.tables.memos.length,1);assert.equal(h.run('pending.length'),1);assert.equal(h.get('editor-form').hidden,false);
    h.run('uploadFile=async()=>{};');await h.run('save()');assert.equal(h.tables.memos.length,1);assert.equal(h.run('pending.length'),0);
});
test('上传网络响应丢失但密文已到达时确认内容，不重复创建附件',async()=>{
    const h=context();h.ctx.uploadStore=new Map();
    h.run("uploadBytes=async(path,blob)=>{uploadStore.set(path,blob);throw Error('timeout')};client.storage.from=()=>({download:async path=>({data:uploadStore.get(path),error:null})});fixtureFile=new File(['file-body'],'retry.txt');");
    await h.run("uploadFile('note',fixtureFile)");assert.equal(h.tables.memo_files.length,1);
    const meta=h.tables.memo_files[0];h.ctx.fixtureMeta=meta;
    const bytes=await h.run('fileBytes(fixtureMeta)');assert.equal(new TextDecoder().decode(bytes),'file-body');
});
test('附件元数据写入失败后重试复用已上传密文',async()=>{
    const h=context();h.ctx.uploadCount=0;h.ctx.failInsert=true;
    h.run("uploadBytes=async()=>{uploadCount++};const originalFrom=client.from.bind(client);client.from=table=>{const q=originalFrom(table);if(table==='memo_files'){const oldInsert=q.insert;q.insert=value=>failInsert?{then(resolve){return Promise.resolve({error:Error('offline')}).then(resolve)}}:oldInsert(value);}return q;};fixtureFile=new File(['payload'],'retry.txt');");
    await assert.rejects(h.run("uploadFile('note',fixtureFile)"),/登记未确认/);assert.equal(h.ctx.uploadCount,1);
    h.ctx.failInsert=false;await h.run("uploadFile('note',fixtureFile)");assert.equal(h.ctx.uploadCount,1);assert.equal(h.tables.memo_files.length,1);
});
test('错误备份校验不写入数据库',async()=>{
    const h=context();const f=await archive(records);h.get('backup-file').files=[f];h.get('backup-password').value='wrong';
    await h.run('checkBackup()');assert.equal(h.calls.length,0);assert.equal(h.run('backupManifest'),null);assert(h.get('restore-button').hidden);
});
test('实际导出与恢复流程：附件字节完整且可换口令恢复到新库',async()=>{
    const source=context(), encrypted=await core.seal(testKey,sample);
    source.tables.memos.push({id:'original-note',user_id:'owner',...encrypted,created_at:'2026',updated_at:'2026'});
    const name=await core.seal(testKey,{body:'complete.bin'}),iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new Uint8Array([0,128,255,42]);
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},testKey,plain);
    source.tables.memo_files.push({id:'original-file',user_id:'owner',note_id:'original-note',file_path:'owner/a.bin',name_ciphertext:name.ciphertext,name_iv:name.iv,file_iv:core.b64(iv),size_bytes:4,mime_type:'application/octet-stream'});
    source.ctx.storageBlob=new Blob([cipher]);source.ctx.exportChunks=[];
    source.run("client.storage.from=()=>({download:async()=>({data:storageBlob,error:null})});window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>exportChunks.push(b),close:async()=>{},abort:async()=>{throw Error('unexpected abort')}})});");
    await source.run('exportBackup()');const file=new Blob(source.ctx.exportChunks),header=await core.backupHeader(file);
    const manifest=await core.inspectBackup(file,testKey,header);assert.equal(manifest.files.length,1);
    const target=context(),targetKey=await core.deriveKey('different-target-password',new Uint8Array(16).fill(9));
    target.ctx.targetKey=targetKey;target.ctx.fixtureArchive=file;target.ctx.fixtureHeader=header;target.ctx.fixtureManifest=manifest;target.ctx.uploaded=new Map();
    target.run("key=targetKey;backupFile=fixtureArchive;backupKey=fixtureKey;backupInfo=fixtureHeader;backupManifest=fixtureManifest;uploadBytes=async(path,blob)=>uploaded.set(path,blob);client.storage.from=()=>({download:async path=>({data:uploaded.get(path),error:null})});");
    await target.run('restoreBackup()');assert.equal(target.tables.memos.length,1);assert.equal(target.tables.memo_files.length,1);
    assert.equal((await core.open(targetKey,target.tables.memos[0])).body,sample.body);
    target.ctx.restoredMeta=target.tables.memo_files[0];assert.deepEqual([...await target.run('fileBytes(restoredMeta)')],[...plain]);
});
