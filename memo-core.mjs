// 加密格式和备份协议。此模块不读取页面或登录配置。
export const ITERATIONS = 210000;
export const MAX_FILE = 20 * 1024 * 1024;
const encoder = new TextEncoder(), decoder = new TextDecoder();
export function b64(bytes) {
    let value = '';
    for (let i = 0; i < bytes.length; i += 32768) value += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(value);
}
export function unb64(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
export async function deriveKey(password, salt) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:ITERATIONS, hash:'SHA-256'}, material,
        {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
export async function seal(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const result = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, encoder.encode(JSON.stringify(value)));
    return {iv:b64(iv), ciphertext:b64(new Uint8Array(result))};
}
export async function open(key, row) {
    const value = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(row.iv)}, key, unb64(row.ciphertext));
    return JSON.parse(decoder.decode(value));
}
export function normalizeNote(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('备忘录格式不正确');
    return {
        title:typeof value.title === 'string' ? value.title : '',
        body:typeof value.body === 'string' ? value.body : '',
        tags:[...new Set((Array.isArray(value.tags) ? value.tags : []).filter(t=>typeof t==='string').map(t=>t.trim()).filter(Boolean))].slice(0,20),
        pinned:value.pinned === true,
        trashedAt:typeof value.trashedAt === 'string' && Number.isFinite(Date.parse(value.trashedAt)) ? value.trashedAt : null
    };
}
export function noteSnapshot(note) { return JSON.stringify(normalizeNote(note)); }
export function isConflict(rows) { return !Array.isArray(rows) || rows.length !== 1; }
export async function restoreId(backupId, userId, kind, originalId) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode([backupId,userId,kind,originalId].join(':'))));
    hash[6]=(hash[6]&15)|80; hash[8]=(hash[8]&63)|128;
    const hex=[...hash.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const MAGIC = encoder.encode('LANMAO-BACKUP-2\n');
const MAX_FRAME = 32 * 1024 * 1024;
function u32(n) { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n); return b; }
export async function backupWriter(sink, key, salt, backupId) {
    const header=encoder.encode(JSON.stringify({version:2, salt, backupId, iterations:ITERATIONS}));
    await sink.write(MAGIC); await sink.write(u32(header.length)); await sink.write(header);
    let index=0, finished=false;
    return {
        async record(record) {
            if (finished) throw Error('备份已结束');
            const iv=crypto.getRandomValues(new Uint8Array(12));
            const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(`${backupId}:${index}`)},key,encoder.encode(JSON.stringify(record))));
            if(encrypted.length>MAX_FRAME) throw Error('备份分段过大');
            await sink.write(u32(encrypted.length)); await sink.write(iv); await sink.write(encrypted); index++;
            if(record.kind==='end') finished=true;
        }
    };
}
export async function backupHeader(file) {
    const pre=new Uint8Array(await file.slice(0,MAGIC.length+4).arrayBuffer());
    if(pre.length!==MAGIC.length+4 || MAGIC.some((v,i)=>pre[i]!==v)) throw Error('不是支持的加密备份文件');
    const n=new DataView(pre.buffer).getUint32(MAGIC.length);
    if(n<1||n>4096) throw Error('备份头损坏');
    const header=JSON.parse(await file.slice(MAGIC.length+4,MAGIC.length+4+n).text());
    if(header.version!==2 || header.iterations!==ITERATIONS || typeof header.backupId!=='string' || !/^[a-f0-9-]{36}$/i.test(header.backupId) || unb64(header.salt).length!==16) throw Error('备份格式不支持');
    return {...header,offset:MAGIC.length+4+n};
}
export async function* backupRecords(file,key,header) {
    let offset=header.offset,index=0,ended=false;
    while(offset<file.size) {
        if(ended) throw Error('备份结束后存在额外数据');
        const prefix=new Uint8Array(await file.slice(offset,offset+16).arrayBuffer());
        if(prefix.length!==16) throw Error('备份不完整');
        const n=new DataView(prefix.buffer).getUint32(0);
        if(n<16||n>MAX_FRAME||offset+16+n>file.size) throw Error('备份分段损坏');
        const bytes=await file.slice(offset+16,offset+16+n).arrayBuffer();
        const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:prefix.slice(4),additionalData:encoder.encode(`${header.backupId}:${index}`)},key,bytes);
        const record=JSON.parse(decoder.decode(raw));
        offset+=16+n; index++;
        ended=record.kind==='end';
        yield record;
    }
    if(!ended) throw Error('备份不完整，缺少结束校验');
}
export async function inspectBackup(file,key,header) {
    let manifest=null,done=false,count=0; const ids=new Set();
    for await(const item of backupRecords(file,key,header)) {
        if(!manifest) {
            if(item.kind!=='manifest'||!Array.isArray(item.notes)||!Array.isArray(item.files)) throw Error('备份目录无效');
            const noteIds=new Set();
            for(const row of item.notes) {
                if(typeof row.id!=='string'||noteIds.has(row.id)||noteIds.size>=10000) throw Error('备忘录目录重复或过大');
                noteIds.add(row.id); normalizeNote(row.note);
            }
            const fileIds=new Set();
            for(const row of item.files) {
                if(typeof row.id!=='string'||fileIds.has(row.id)||!noteIds.has(row.note_id)||typeof row.name!=='string'||!Number.isInteger(row.size)||row.size<0||row.size>MAX_FILE) throw Error('附件目录无效');
                fileIds.add(row.id);
            }
            manifest=item;
        } else if(item.kind==='file') {
            const meta=manifest.files.find(f=>f.id===item.id);
            if(!meta||ids.has(item.id)||typeof item.data!=='string'||unb64(item.data).length!==meta.size) throw Error('附件内容或数量不符');
            ids.add(item.id); count++;
        } else if(item.kind==='end') {
            if(item.files!==count||count!==manifest.files.length||item.notes!==manifest.notes.length) throw Error('备份未包含全部内容');
            done=true;
        } else throw Error('备份包含未知分段');
    }
    if(!manifest||!done) throw Error('备份不完整');
    return manifest;
}
