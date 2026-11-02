import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../login.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function safeNext()'),source.indexOf('function goNext()'));
function next(raw){const ctx=vm.createContext({window:{location:{origin:'https://lanmaospace.pages.dev',search:'?next='+encodeURIComponent(raw)}},URL,URLSearchParams});vm.runInContext(fn,ctx);return vm.runInContext('safeNext()',ctx);}
test('头像页两种正式地址在登录后正确返回',()=>{assert.equal(next('/profile'),'/profile');assert.equal(next('/profile.html'),'/profile.html');});
test('工具分类、搜索参数及锚点在登录后保留',()=>{assert.equal(next('/tools/?category=academic#tools-search'),'/tools/?category=academic#tools-search');});
test('外部网址和协议相对网址不能作为回跳目标',()=>{for(const raw of ['https://evil.invalid/profile','//evil.invalid/profile','javascript:alert(1)'])assert.equal(next(raw),'index.html');});
test('未知站内路径与缺失回跳参数返回首页',()=>{assert.equal(next('/unknown'),'index.html');assert.equal(next(''),'index.html');});
