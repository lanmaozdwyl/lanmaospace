// 只读上线验收：不登录、不访问私人内容、不读取配置密钥。
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const site='https://lanmaospace.netlify.app';
const root=new URL('../',import.meta.url);
const digest=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
const checks=[
    ['memo.html',['backup-panel','conflict-panel','preview-dialog']],
    ['memo.js',null],['memo-core.mjs',null],['memo.css',null]
];
let ready=true;
for(const [path,markers] of checks) {
    try {
        const response=await fetch(`${site}/${path}?verify=${Date.now()}`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
        if(!response.ok) {console.log(`${path}: HTTP ${response.status}`);ready=false;continue;}
        const remote=await response.text();
        const matches=markers?markers.every(marker=>remote.includes(marker)):digest(remote)===digest(await readFile(new URL(path,root),'utf8'));
        console.log(`${path}: HTTP ${response.status}, ${matches?'MATCH':'OLD_OR_DIFFERENT'}`);
        ready &&= matches;
    } catch(error) {ready=false;console.log(`${path}: REQUEST_FAILED (${error.name})`);}
}
console.log(ready?'PASS: 正式站已加载本地版本的备忘录资源。':'NOT_READY: 正式站尚未匹配本地版本，请检查部署状态；不要仅凭推送成功声称已上线。');
process.exitCode=ready?0:2;
