import './check.mjs';
import {mkdirSync,copyFileSync,cpSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'dist');
// Cloudflare 使用干净 checkout；本地存在 dist 时拒绝覆盖，避免旧文件混入。
if(existsSync(out))throw Error('dist 已存在，请先将旧目录移走，再重新构建。');
mkdirSync(out);
const files=['index.html','store.html','memo.html','login.html','profile.html','faq.html','space.html','account.html','404.html','reader.html','style.css','store.css','memo.css','auth.css','profile.css','faq.css','space.css','motion.css','reader.css','script.js','store.js','memo.js','memo-core.mjs','memo-config.js','login.js','auth-guard.js','guestbook.js','guestbook-admin.js','profile.js','space.js','account.js','motion.js','reader.js','reader-highlight.js','reader-gesture.js','products.json','robots.txt','sitemap.xml','_headers','manifest.json','sw.js','_redirects','mobile.css','mobile-nav.js','focus.js','ambient.js','reader-audio.js','offline.html','pdf.worker.mjs','_worker.js'];
for(const file of files)copyFileSync(join(root,file),join(out,file));
// 上游在 lib/pageflipopen/ 里附带了一份与根目录字节完全相同的 pdf.worker.mjs（各 2.2 MB），
// 而 reader.js 只引用 /pdf.worker.mjs，过滤掉副本以免 dist 白增 2.2 MB。
// functions/ 已随 Pages Functions 版 sbproxy 一起删除：git 不跟踪空目录，列入会让 cpSync ENOENT 打断构建。
for(const dir of ['lib','tools','images','audio'])cpSync(join(root,dir),join(out,dir),{recursive:true,filter:src=>!src.replaceAll('\\','/').endsWith('/pdf.worker.mjs')});
console.log('PASS: dist contains only website runtime files');
