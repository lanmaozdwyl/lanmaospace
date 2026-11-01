import {ITERATIONS, MAX_FILE, b64, unb64, deriveKey, seal, open, normalizeNote, noteSnapshot, isConflict,
    restoreId, backupWriter, backupHeader, backupRecords, inspectBackup} from './memo-core.mjs';

const $=id=>document.getElementById(id);
const panels=['setup-panel','login-panel','owner-panel','passphrase-panel','app-panel'];
const BUCKET='memo-files', CHECK='lanmao-memo-check-v1', IDLE_MS=10*60*1000;
let client,user,key,vault,notes=[],files=[],pending=[],editing=null,baseline='',busy=false,viewTrash=false;
let lastActivity=Date.now(), lockRequested=false, sealedDraft=null, previewUrl=null, generation=0;
let backupFile=null, backupKey=null, backupInfo=null, backupManifest=null;
const requests=new Set();
let operationEpoch=0;
let uploadAttempts=new WeakMap();
function assertActive() { if(!key || operationEpoch!==generation) throw Error('备忘录已锁定，操作已停止。'); }
function show(id) { panels.forEach(p=>$(p).hidden=p!==id); }
function status(text) { if(key) $('memo-status').textContent=text; }
function message(id,text) { $(id).textContent=text; }
function owner(u) { const e=window.LANMAO_MEMO_CONFIG?.ownerEmail?.trim().toLowerCase(); return !!e&&u?.email?.toLowerCase()===e; }
function fail(error) { console.error(error); return error?.message||'操作失败，请检查网络后重试。'; }
function size(n) { return n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`; }
function state() { return normalizeNote({title:$('note-title').value,body:$('note-body').value,tags:$('note-tags').value.split(/[,，]/),pinned:$('note-pinned').checked,trashedAt:editing?.note.trashedAt}); }
function dirty() { return !$('editor-form').hidden&&(noteSnapshot(state())!==baseline||pending.length>0); }
function canLeave() { return !busy && (!dirty()||window.confirm('有未保存的内容，确定放弃这些修改吗？')); }
function controls(disabled) {
    $('app-panel').querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=disabled);
    $('backup-panel').querySelectorAll('button,input').forEach(el=>el.disabled=disabled);
}
async function task(fn) {
    if(busy||!key) return;
    busy=true; operationEpoch=generation; controls(true);
    try { await fn(); } catch(e) { status(fail(e)); }
    finally {
        busy=false; controls(false); progress(null);
        if(lockRequested || Date.now()-lastActivity>=IDLE_MS) { lockRequested=false; await lockVault(true); }
    }
}
function clearPreview() {
    $('image-preview').removeAttribute('src'); $('image-preview').alt=''; $('preview-title').textContent='图片预览';
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl=null; $('preview-dialog').close();
}
function clearBackup() {
    backupFile=null; backupKey=null; backupInfo=null; backupManifest=null;
    $('backup-password').value=''; $('backup-file').value=''; $('backup-summary').textContent='';
    $('restore-button').hidden=true;
}
function clearEditor() {
    editing=null; pending=[]; baseline='';
    $('editor-form').reset(); $('editor-form').hidden=true; $('selected-files').replaceChildren();
    $('conflict-panel').hidden=true;
}
function wipe() {
    generation++; uploadAttempts=new WeakMap(); key=null; vault=null; notes=[]; files=[];
    for(const xhr of requests) xhr.abort(); requests.clear();
    clearEditor(); clearPreview(); clearBackup();
    $('memo-list').replaceChildren(); $('memo-empty').hidden=true; progress(null);
    $('memo-search').value=''; $('memo-usage').textContent=''; $('memo-status').textContent='';
    $('backup-panel').hidden=true; $('memo-passphrase').value=''; $('memo-passphrase-confirm').value='';
}
async function lockVault(automatic=false) {
    if(!key) return;
    if(busy) { lockRequested=true; status('当前操作完成后将自动锁定。'); return; }
    if(!automatic&&!canLeave()) return;
    busy=true; controls(true);
    const epoch=generation;
    try {
        // 自动锁定时暂存加密草稿，不把明文放入任何浏览器存储。
        if(automatic&&dirty()) {
            const draft={note:state(),editing,baseline,files:[]};
            for(const f of pending) {
                const a=uploadAttempts.get(f);
                draft.files.push({name:f.name,type:f.type,data:b64(new Uint8Array(await f.arrayBuffer())),attempt:a?{...a,data:a.data?b64(new Uint8Array(a.data)):null}:null});
            }
            const encrypted=await seal(key,draft);
            if(epoch!==generation){busy=false;controls(false);return;}
            sealedDraft=encrypted;
        } else sealedDraft=null;
    } catch(e) { busy=false; controls(false); status('草稿加密失败，请先保存再锁定。'); lastActivity=Date.now(); return; }
    wipe(); busy=false; controls(false); show('passphrase-panel');
    await prepareUnlock();
    message('unlock-status',automatic?'已自动锁定；未保存的草稿仅在本标签页加密暂存，解锁后恢复。':'已锁定。');
}
async function prepareUnlock() {
    const epoch=generation;
    const {data,error}=await client.from('memo_vault').select('salt,check_ciphertext,check_iv').eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    if(epoch!==generation||!user)return;
    vault=data;
    $('passphrase-title').textContent=data?'输入备忘录口令解锁':'设置备忘录口令';
    $('passphrase-confirm-group').hidden=!!data; $('memo-passphrase-confirm').required=!data;
    show('passphrase-panel');
}
async function unlock(password) {
    if(busy)throw Error('上一项操作正在结束，请稍后重试解锁。');
    const epoch=generation;
    const active=()=>{if(epoch!==generation||!user)throw Error('登录状态已改变，请重新登录。');};
    if(password.length<8) throw Error('备忘录口令至少 8 位。');
    if(!vault) {
        if(password!==$('memo-passphrase-confirm').value) throw Error('两次输入的口令不一致。');
        const salt=crypto.getRandomValues(new Uint8Array(16));
        const newKey=await deriveKey(password,salt), check=await seal(newKey,{body:CHECK});
        active();
        const row={user_id:user.id,salt:b64(salt),check_ciphertext:check.ciphertext,check_iv:check.iv};
        const {error}=await client.from('memo_vault').insert(row); if(error) throw error;
        active(); vault=row; key=newKey;
    } else {
        const newKey=await deriveKey(password,unb64(vault.salt));
        const check=await open(newKey,{ciphertext:vault.check_ciphertext,iv:vault.check_iv});
        if(check.body!==CHECK) throw Error('备忘录口令不正确。');
        active(); key=newKey;
    }
    operationEpoch=generation; lastActivity=Date.now(); show('app-panel'); await reload();
    if(sealedDraft) {
        const draft=await open(key,sealedDraft); sealedDraft=null;
        setEditor(draft.note,draft.editing); baseline=draft.baseline;
        pending=draft.files.map(f=>{
            const file=new File([unb64(f.data)],f.name,{type:f.type});
            if(f.attempt)uploadAttempts.set(file,{...f.attempt,data:f.attempt.data?unb64(f.attempt.data).buffer:null});
            return file;
        });
        renderPending(); status('已恢复锁定前未保存的草稿，请保存。');
    }
}
async function allRows(table,fields) {
    const result=[];
    for(let start=0;;start+=500) {
        const {data,error}=await client.from(table).select(fields).eq('user_id',user.id).order('id').range(start,start+499);
        if(error) throw error;
        result.push(...data); if(data.length<500) return result;
    }
}
async function snapshot() {
    const rawNotes=await allRows('memos','id,ciphertext,iv,created_at,updated_at');
    const rawFiles=await allRows('memo_files','id,note_id,file_path,name_ciphertext,name_iv,file_iv,mime_type,size_bytes');
    return {rawNotes,rawFiles};
}
async function decodeRows(rawNotes,rawFiles) {
    const decodedNotes=[],decodedFiles=[];
    // 解不开时明确失败，不能悄悄漏掉数据再声称完整备份。
    for(const row of rawNotes) decodedNotes.push({...row,note:normalizeNote(await open(key,row))});
    for(const row of rawFiles) {
        const name=await open(key,{ciphertext:row.name_ciphertext,iv:row.name_iv});
        if(typeof name.body!=='string') throw Error('附件名称解密失败');
        decodedFiles.push({...row,name:name.body});
    }
    return {decodedNotes,decodedFiles};
}
async function reload() {
    const epoch=generation;
    const rawNotes=await allRows('memos','id,ciphertext,iv,created_at,updated_at');
    let rawFiles=[]; let fileError=false;
    try { rawFiles=await allRows('memo_files','id,note_id,file_path,name_ciphertext,name_iv,file_iv,mime_type,size_bytes'); }
    catch(e) { console.error(e); fileError=true; }
    if(epoch!==generation||!key) return;
    const result=await decodeRows(rawNotes,rawFiles);
    if(epoch!==generation||!key) return;
    notes=result.decodedNotes; files=result.decodedFiles;
    $('memo-usage').textContent=fileError?'附件列表暂不可用；正文仍可编辑。':`附件 ${size(files.reduce((n,f)=>n+f.size_bytes,0))} · 闲置 10 分钟自动锁定`;
    render(); renderPending();
}
function button(text,fn) {
    const el=document.createElement('button'); el.type='button'; el.textContent=text;
    el.addEventListener('click',fn); return el;
}
function render() {
    const q=$('memo-search').value.trim().toLowerCase(); $('memo-list').replaceChildren();
    const list=notes.filter(r=>!!r.note.trashedAt===viewTrash).filter(r=>
        [r.note.title,r.note.body,...r.note.tags,...files.filter(f=>f.note_id===r.id).map(f=>f.name)].join('\n').toLowerCase().includes(q))
        .sort((a,b)=>Number(b.note.pinned)-Number(a.note.pinned)||b.updated_at.localeCompare(a.updated_at));
    $('trash-button').textContent=viewTrash?'返回备忘录':`回收站（${notes.filter(n=>n.note.trashedAt).length}）`;
    $('memo-empty').hidden=!!list.length; $('memo-empty').textContent=viewTrash?'回收站为空。':'没有匹配的备忘录。';
    for(const row of list) {
        const card=document.createElement('article'); card.className='memo-item';
        const h=document.createElement('h3'); h.textContent=(row.note.pinned?'📌 ':'')+(row.note.title||'无标题');
        const info=document.createElement('p'); info.className='memo-note'; info.textContent=row.note.tags.map(t=>'#'+t).join(' · ');
        const time=document.createElement('time'); time.textContent=new Date(row.updated_at).toLocaleString('zh-CN');
        const body=document.createElement('p'); body.textContent=row.note.body;
        const actions=document.createElement('div'); actions.className='memo-item-actions';
        if(!viewTrash) {
            actions.append(button('编辑',()=>openEditor(row)),button(row.note.pinned?'取消置顶':'置顶',()=>changeNote(row,{pinned:!row.note.pinned})),button('移入回收站',()=>changeNote(row,{trashedAt:new Date().toISOString()})));
        } else actions.append(button('恢复',()=>changeNote(row,{trashedAt:null})),button('永久删除',()=>permanentDelete(row)));
        card.append(h,info,time,body,actions);
        for(const f of files.filter(f=>f.note_id===row.id)) {
            const box=document.createElement('div'); box.className='memo-file-row';
            const name=document.createElement('span'); name.textContent=`${f.name} · ${size(f.size_bytes)}`;
            box.append(name,button('下载',()=>download(f)));
            if(/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(f.mime_type)) box.append(button('预览',()=>preview(f)));
            card.append(box);
        }
        $('memo-list').append(card);
    }
    if(busy) controls(true);
}
function setEditor(note,row) {
    editing=row; pending=[];
    $('note-title').value=note.title; $('note-body').value=note.body;
    $('note-tags').value=note.tags.join(', '); $('note-pinned').checked=note.pinned;
    $('editor-form').hidden=false; $('conflict-panel').hidden=true;
    baseline=noteSnapshot(note); renderPending();
}
function openEditor(row) {
    if(!canLeave()) return;
    setEditor(row?.note||normalizeNote({}),row); $('note-title').focus();
}
function renderPending() {
    const box=$('selected-files'); box.replaceChildren();
    for(const f of files.filter(f=>f.note_id===editing?.id)) {
        const row=document.createElement('div'); row.className='memo-file-row';
        const label=document.createElement('span'); label.textContent=`${f.name}（已上传）`;
        row.append(label,button('删除附件',()=>deleteFile(f))); box.append(row);
    }
    pending.forEach((f,i)=>{
        const row=document.createElement('div'); row.className='memo-file-row';
        const label=document.createElement('span'); label.textContent=`${f.name}（待上传 / 可重试）`;
        row.append(label,button('移除',()=>{if(busy)return;pending.splice(i,1);renderPending();})); box.append(row);
    });
    if(busy) controls(true);
}
async function writeNote(row,note) {
    const encrypted=await seal(key,normalizeNote(note));
    assertActive();
    const timestamp=new Date().toISOString();
    let query;
    if(row) query=client.from('memos').update({...encrypted,updated_at:timestamp}).eq('user_id',user.id).eq('id',row.id).eq('ciphertext',row.ciphertext).eq('iv',row.iv);
    else query=client.from('memos').insert({id:crypto.randomUUID(),user_id:user.id,...encrypted,updated_at:timestamp});
    const {data,error}=await query.select('id,ciphertext,iv,created_at,updated_at');
    if(error) throw error;
    assertActive();
    if(isConflict(data)) { const e=Error('另一台设备已修改或删除此条，当前草稿未覆盖远程内容。'); e.conflict=true; throw e; }
    return {...data[0],note:normalizeNote(note)};
}
async function save(asCopy=false) {
    await task(async()=>{
        const note=state(); if(!note.title.trim()&&!note.body.trim()) throw Error('请填写标题或内容。');
        status('正在加密并同步…');
        try { editing=await writeNote(asCopy?null:editing,note); }
        catch(e) { if(e.conflict) $('conflict-panel').hidden=false; throw e; }
        baseline=noteSnapshot(note); $('conflict-panel').hidden=true;
        const failed=[]; const queue=[...pending];
        for(let i=0;i<queue.length;i++) {
            try { await uploadFile(editing.id,queue[i],undefined,p=>progress(p,`附件 ${i+1}/${queue.length}：${queue[i].name}`)); }
            catch(e) { assertActive(); console.error(e); failed.push(queue[i]); }
        }
        assertActive(); pending=failed; renderPending();
        try { await reload(); } catch(e) { status('保存已完成，但列表刷新失败；请稍后刷新。'); return; }
        if(failed.length) status(`正文已保存，${failed.length} 个附件失败。文件已保留，点“保存并同步”重试。`);
        else { clearEditor(); status('已保存并同步。'); }
        progress(null);
    });
}
async function changeNote(row,patch) {
    if(!canLeave()) return;
    await task(async()=>{await writeNote(row,{...row.note,...patch});clearEditor();await reload();status(patch.trashedAt?'已移入回收站，附件一并保留。':'已更新。');});
}
function progress(value,label='') {
    if(value!==null&&!key)return;
    $('transfer-panel').hidden=value===null;
    $('transfer-progress').value=value||0; $('transfer-label').textContent=label+(value===null?'':` ${Math.round(value)}%`);
}
async function uploadBytes(path,blob,onProgress) {
    const {data,error}=await client.auth.getSession(); if(error||!data.session) throw Error('登录已过期，请重新登录。');
    assertActive();
    const cfg=window.LANMAO_MEMO_CONFIG;
    await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest(); requests.add(xhr);
        xhr.open('POST',`${cfg.url.replace(/\/$/,'')}/storage/v1/object/${BUCKET}/${path}`);
        xhr.setRequestHeader('Authorization',`Bearer ${data.session.access_token}`);
        xhr.setRequestHeader('apikey',cfg.anonKey); xhr.setRequestHeader('Content-Type','application/octet-stream');
        xhr.setRequestHeader('x-upsert','false'); xhr.timeout=180000;
        xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(e.loaded/e.total*95);};
        xhr.onload=()=>{requests.delete(xhr); if(xhr.status>=200&&xhr.status<300)resolve();else reject(Error(`附件上传失败（${xhr.status}），可重试。`));};
        const rejectNetwork=()=>{requests.delete(xhr);reject(Error('附件上传中断，可重试。'));};
        xhr.onerror=rejectNetwork; xhr.ontimeout=rejectNetwork; xhr.onabort=rejectNetwork; xhr.send(blob);
    });
}
async function uploadFile(noteId,file,id,onProgress) {
    assertActive();
    if(file.size>MAX_FILE) throw Error('附件超过 20 MB。');
    let attempt=uploadAttempts.get(file);
    if(!attempt || attempt.noteId!==noteId) {
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,await file.arrayBuffer());
        const name=await seal(key,{body:file.name});
        assertActive();
        attempt={id:id||crypto.randomUUID(),noteId,path:`${user.id}/${crypto.randomUUID()}.bin`,iv:b64(iv),name,data};
        uploadAttempts.set(file,attempt);
    }
    // 重试先检查已登记的文件，避免响应丢失导致重复上传。
    const existing=await client.from('memo_files').select('id,file_path').eq('id',attempt.id).eq('user_id',user.id).maybeSingle();
    if(existing.error) throw existing.error;
    assertActive();
    if(existing.data) {uploadAttempts.delete(file);onProgress?.(100);return;}
    if(!attempt.uploaded) {
        try {await uploadBytes(attempt.path,new Blob([attempt.data],{type:'application/octet-stream'}),onProgress);}
        catch(error) {
            // 上传超时也可能已成功；只有核对密文字节后才接受这个结果。
            const check=await client.storage.from(BUCKET).download(attempt.path);
            assertActive();
            if(check.error) throw error;
            const actual=new Uint8Array(await check.data.arrayBuffer()),expected=new Uint8Array(attempt.data);
            if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i])) throw error;
        }
        attempt.uploaded=true; attempt.data=null;
    }
    assertActive();
    const {error}=await client.from('memo_files').insert({id:attempt.id,user_id:user.id,note_id:noteId,file_path:attempt.path,name_ciphertext:attempt.name.ciphertext,name_iv:attempt.name.iv,file_iv:attempt.iv,mime_type:file.type||'application/octet-stream',size_bytes:file.size});
    assertActive();
    if(error) {
        const check=await client.from('memo_files').select('id,file_path').eq('id',attempt.id).eq('user_id',user.id).maybeSingle();
        assertActive();
        if(check.error||!check.data) throw Error('附件登记未确认；文件已保留，可直接重试。');
        if(check.data.file_path!==attempt.path) {
            const cleanup=await client.storage.from(BUCKET).remove([attempt.path]);
            if(cleanup.error) throw Error('恢复已存在，但临时附件清理失败，请检查存储后台。');
        }
    }
    uploadAttempts.delete(file);onProgress?.(100);
}

async function fileBytes(file) {
    const {data,error}=await client.storage.from(BUCKET).download(file.file_path); if(error) throw error;
    assertActive();
    const bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(file.file_iv)},key,await data.arrayBuffer()));
    assertActive(); return bytes;
}
function downloadBlob(blob,name) {
    assertActive();
    const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function download(file) { await task(async()=>{downloadBlob(new Blob([await fileBytes(file)],{type:file.mime_type}),file.name);status('下载已准备好。');}); }
async function preview(file) {
    await task(async()=>{
        clearPreview(); previewUrl=URL.createObjectURL(new Blob([await fileBytes(file)],{type:file.mime_type}));
        $('image-preview').src=previewUrl; $('image-preview').alt=file.name; $('preview-title').textContent=file.name;
        $('preview-dialog').showModal();
    });
}
async function deleteFile(file) {
    if(busy||!window.confirm('永久删除这个附件？建议先导出备份。')) return;
    await task(async()=>{
        const removed=await client.storage.from(BUCKET).remove([file.file_path]); if(removed.error) throw Error('文件删除失败，记录保留，可重试。');
        const result=await client.from('memo_files').delete().eq('id',file.id).eq('user_id',user.id).select('id');
        if(result.error||isConflict(result.data)) throw Error('文件已删除，记录删除未确认；请刷新检查后重试。');
        await reload(); status('附件已删除。');
    });
}
async function permanentDelete(row) {
    if(!canLeave()||!window.confirm('永久删除这条备忘录和附件？此操作无法撤销，请先备份。')) return;
    await task(async()=>{
        // 先用条件更新声明版本，拒绝过期标签页的删除请求。
        const claimed=await writeNote(row,row.note);
        const {data,error}=await client.from('memo_files').select('file_path').eq('user_id',user.id).eq('note_id',row.id); if(error) throw error;
        if(data.length) { const r=await client.storage.from(BUCKET).remove(data.map(f=>f.file_path)); if(r.error) throw Error('附件删除失败，备忘录记录保留，请刷新重试。'); }
        const result=await client.from('memos').delete().eq('id',row.id).eq('user_id',user.id).eq('ciphertext',claimed.ciphertext).select('id');
        if(result.error||isConflict(result.data)) throw Error('附件已处理，但备忘录删除未确认；请刷新检查。');
        clearEditor(); await reload(); status('已永久删除。');
    });
}

// 流式分段备份：每个分段独立认证并绑定备份 ID / 顺序，附件不要求一次全部装进内存。
async function exportBackup() {
    if(!canLeave()) return;
    let writable=null;
    if(window.showSaveFilePicker) {
        try { const handle=await window.showSaveFilePicker({suggestedName:`lanmao-${new Date().toISOString().slice(0,10)}.lmb`,types:[{description:'加密备份',accept:{'application/octet-stream':['.lmb']}}]}); writable=await handle.createWritable(); }
        catch(e) {if(e.name==='AbortError')return;status('无法创建备份文件，请检查浏览器文件权限。');return;}
    }
    if(!key || busy) {if(writable)await writable.abort().catch(()=>{});return;}
    await task(async()=>{
        const chunks=[]; let bytes=0; let completed=false;
        const sink=writable||{async write(chunk){bytes+=chunk.length;if(bytes>100*1024*1024)throw Error('此浏览器不支持大备份直接写盘；请用最新版 Edge 或 Chrome 导出。');chunks.push(chunk);}};
        try {
            status('正在读取完整备份目录…'); const original=await snapshot();
            const decoded=await decodeRows(original.rawNotes,original.rawFiles); assertActive();
            const noteIds=new Set(original.rawNotes.map(n=>n.id));
            if(decoded.decodedFiles.some(f=>!noteIds.has(f.note_id))) throw Error('附件目录不一致，请刷新后重试备份。');
            const writer=await backupWriter(sink,key,vault.salt,crypto.randomUUID());
            await writer.record({kind:'manifest',notes:decoded.decodedNotes.map(n=>({id:n.id,note:n.note})),files:decoded.decodedFiles.map(f=>({id:f.id,note_id:f.note_id,name:f.name,size:f.size_bytes,type:f.mime_type}))});
            for(let i=0;i<decoded.decodedFiles.length;i++) {
                const f=decoded.decodedFiles[i]; progress(i/decoded.decodedFiles.length*100,`备份附件 ${i+1}/${decoded.decodedFiles.length}`);
                const data=await fileBytes(f); if(data.length!==f.size_bytes) throw Error('附件大小不符，已停止备份。');
                await writer.record({kind:'file',id:f.id,data:b64(data)});
            }
            const latest=await snapshot();
            if(JSON.stringify(original)!==JSON.stringify(latest)) throw Error('备份期间其他设备修改了内容，请重新导出。');
            await writer.record({kind:'end',notes:original.rawNotes.length,files:original.rawFiles.length});
            assertActive();
            if(writable) await writable.close(); else downloadBlob(new Blob(chunks,{type:'application/octet-stream'}),`lanmao-${new Date().toISOString().slice(0,10)}.lmb`);
            completed=true; status('加密备份已导出，包含正文、标签、回收站和全部附件。请保留备份时使用的备忘录口令。');
        } finally { if(writable&&!completed)await writable.abort().catch(()=>{}); progress(null); }
    });
}
async function checkBackup() {
    await task(async()=>{
        clearRestoreState(); backupFile=$('backup-file').files[0];
        if(!backupFile) throw Error('请先选择 .lmb 备份文件。');
        let password=$('backup-password').value; $('backup-password').value='';
        const info=await backupHeader(backupFile); const sourceKey=await deriveKey(password,unb64(info.salt)); password='';
        assertActive(); backupInfo=info; backupKey=sourceKey;
        message('backup-summary','正在逐段校验，尚未写入任何数据…');
        try { const manifest=await inspectBackup(backupFile,backupKey,backupInfo); assertActive(); backupManifest=manifest; }
        catch(e) {clearRestoreState();throw Error('备份校验失败：口令不正确，或文件损坏、不完整。');}
        message('backup-summary',`校验通过：${backupManifest.notes.length} 条备忘录，${backupManifest.files.length} 个附件。将恢复为副本，保留当前内容；同一备份重试不会重复创建。`);
        $('restore-button').hidden=false;
    });
}
function clearRestoreState() {backupKey=null;backupInfo=null;backupManifest=null;$('restore-button').hidden=true;}
async function restoreBackup() {
    if(!backupManifest||!canLeave()) return;
    await task(async()=>{
        // 校验阶段没有写入；恢复采用确定性新 ID，失败可从同一文件继续。
        const noteMap=new Map();
        for(const row of backupManifest.notes) {
            const id=await restoreId(backupInfo.backupId,user.id,'note',row.id); assertActive(); noteMap.set(row.id,id);
            const exists=await client.from('memos').select('id').eq('id',id).eq('user_id',user.id).maybeSingle(); if(exists.error)throw exists.error;
            if(!exists.data) {
                const encrypted=await seal(key,normalizeNote(row.note)); assertActive();
                const result=await client.from('memos').upsert({id,user_id:user.id,...encrypted},{onConflict:'id',ignoreDuplicates:true});if(result.error)throw result.error;
            }
        }
        let done=0;
        for await(const record of backupRecords(backupFile,backupKey,backupInfo)) {
            if(record.kind!=='file')continue;
            const meta=backupManifest.files.find(f=>f.id===record.id);
            const id=await restoreId(backupInfo.backupId,user.id,'file',record.id);
            const exists=await client.from('memo_files').select('id').eq('id',id).eq('user_id',user.id).maybeSingle();if(exists.error)throw exists.error;
            assertActive();
            if(!exists.data) await uploadFile(noteMap.get(meta.note_id),new File([unb64(record.data)],meta.name,{type:meta.type||'application/octet-stream'}),id,p=>progress(p,`恢复附件 ${done+1}/${backupManifest.files.length}`));
            done++;
        }
        clearEditor(); await reload(); clearBackup(); progress(null);status('备份已恢复为副本，原有内容未覆盖。');
    });
}

window.addEventListener('beforeunload',e=>{if(dirty()||busy||sealedDraft){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&!a.hasAttribute('download')&&!canLeave())e.preventDefault();});
for(const event of ['pointerdown','keydown','input','scroll']) document.addEventListener(event,()=>{
    if(key&&Date.now()-lastActivity>=IDLE_MS) {lockVault(true).catch(e=>status(fail(e)));return;}
    lastActivity=Date.now();
},{passive:true});
setInterval(()=>{if(key&&Date.now()-lastActivity>=IDLE_MS)lockVault(true).catch(e=>status(fail(e)));},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&key&&Date.now()-lastActivity>=IDLE_MS)lockVault(true).catch(e=>status(fail(e)));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('editor-form').hidden&&canLeave())clearEditor();});
$('new-note-button').onclick=()=>openEditor(null);
$('cancel-edit-button').onclick=()=>{if(canLeave())clearEditor();};
$('editor-form').onsubmit=e=>{e.preventDefault();save();};
$('save-copy-button').onclick=()=>save(true);
$('refresh-button').onclick=()=>{if(canLeave())task(async()=>{clearEditor();await reload();status('已刷新。');});};
$('trash-button').onclick=()=>{if(canLeave()){clearEditor();viewTrash=!viewTrash;render();}};
$('memo-search').oninput=render;
$('lock-button').onclick=()=>lockVault(false).catch(e=>status(fail(e)));
$('note-files').onchange=e=>{
    const rejected=[];
    for(const f of e.target.files){if(f.size>MAX_FILE)rejected.push(f.name);else pending.push(f);}
    e.target.value='';renderPending();if(rejected.length)status('超过 20 MB，未添加：'+rejected.join('、'));
};
$('preview-close').onclick=clearPreview;
$('preview-dialog').addEventListener('close',()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}$('image-preview').removeAttribute('src');});
$('backup-button').onclick=()=>{if(!busy)$('backup-panel').hidden=!$('backup-panel').hidden;};
$('export-button').onclick=exportBackup;
$('check-backup-button').onclick=checkBackup;
$('restore-button').onclick=restoreBackup;
$('backup-file').onchange=()=>{clearRestoreState();$('backup-summary').textContent='';$('backup-password').value='';};
async function signout() {
    if(!canLeave())return;
    sealedDraft=null;wipe();show('login-panel');
    const {error}=await client.auth.signOut();if(error)message('login-status','退出登录未确认，请检查网络。');
}
$('signout-button').onclick=signout;$('owner-signout-button').onclick=signout;
$('login-form').onsubmit=async e=>{
    e.preventDefault();$('login-button').disabled=true;
    try{const {data,error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(error)throw error;user=data.user;$('login-password').value='';if(owner(user))await prepareUnlock();else show('owner-panel');}
    catch(e){message('login-status','登录失败，请检查账号或网络。');}finally{$('login-button').disabled=false;}
};
$('passphrase-form').onsubmit=async e=>{
    e.preventDefault();$('unlock-button').disabled=true;message('unlock-status','正在解锁…');
    try{await unlock($('memo-passphrase').value);message('unlock-status','');}
    catch(e){if(key){status('已解锁，但读取内容失败：'+fail(e));}else message('unlock-status',e.name==='OperationError'?'口令不正确或加密数据损坏。':fail(e));}
    finally{$('memo-passphrase').value='';$('memo-passphrase-confirm').value='';$('unlock-button').disabled=false;}
};
async function init() {
    const cfg=window.LANMAO_MEMO_CONFIG;
    if(!cfg?.url?.startsWith('https://')||!cfg.anonKey){show('setup-panel');return;}
    try {
        const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        client=createClient(cfg.url,cfg.anonKey);
        client.auth.onAuthStateChange((event,session)=>{
            if(event==='SIGNED_OUT'||(user&&session?.user?.id&&user.id!==session.user.id)) {
                sealedDraft=null;wipe();user=null;show('login-panel');
            }
        });
        const {data,error}=await client.auth.getSession();if(error)throw error;
        user=data.session?.user;
        if(!user)show('login-panel');else if(!owner(user))show('owner-panel');else await prepareUnlock();
    } catch(e){show('login-panel');message('login-status','初始化失败，请检查网络后刷新。');console.error(e);}
}
init();
