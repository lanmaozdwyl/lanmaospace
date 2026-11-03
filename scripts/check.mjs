import {readdirSync, readFileSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
function run(args) {
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status||1);
}
function scan(dir) {
  for(const name of readdirSync(dir)) {
    if(['.git','node_modules','dist'].includes(name))continue;
    const path=join(dir,name);
    if(statSync(path).isDirectory())scan(path);
    else if(/\.(m?js)$/.test(name))run(['--check',path]);
    else if(name==='products.json')JSON.parse(readFileSync(path,'utf8'));
  }
}
scan(root);
run(['--test','tests/memo.test.mjs','tests/guestbook-admin.test.mjs','tests/catalog.test.mjs','tests/store.test.mjs','tests/avatar.test.mjs','tests/tools.test.mjs','tests/login-next.test.mjs','tests/space.test.mjs','tests/space-export.test.mjs']);
console.log('PASS: JavaScript syntax, product JSON and memo regression tests');
