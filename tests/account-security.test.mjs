import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import{validateNewPassword,currentAccount,sendAccountReset,signOutEverywhere}from'../lib/account-security.mjs';
test('新密码至少8位且同时有英文字母和数字，不强制大小写或符号',()=>{assert(validateNewPassword('abc1234'));assert(validateNewPassword('abcdefgh'));assert(validateNewPassword('12345678'));assert.equal(validateNewPassword('abc12345'),null);assert.equal(validateNewPassword('ABC12345'),null);assert.equal(validateNewPassword('my independent phrase 1'),null);assert(validateNewPassword('a1'+'x'.repeat(127)));});
test('当前账号需要服务端认证且不能悄悄切换身份',async()=>{const c={auth:{getUser:async()=>({data:{user:{id:'a'}}})}};assert.equal((await currentAccount(c,'a')).id,'a');await assert.rejects(currentAccount(c,'b'));await assert.rejects(currentAccount({auth:{getUser:async()=>({error:Error('expired')})}}));});
test('重置请求只发给服务端确认的当前账号邮箱',async()=>{let sent;const c={auth:{getUser:async()=>({data:{user:{id:'a',email:'fixture@example.invalid'}}}),resetPasswordForEmail:async(email,options)=>{sent={email,options};return{};}}};await sendAccountReset(c,'a','https://lanmaospace.pages.dev');assert.equal(sent.email,'fixture@example.invalid');assert.equal(sent.options.redirectTo,'https://lanmaospace.pages.dev/login.html');sent=null;await assert.rejects(sendAccountReset(c,'b','https://lanmaospace.pages.dev'));assert.equal(sent,null);});
test('退出所有设备明确使用global并传播失败',async()=>{let scope;await signOutEverywhere({auth:{signOut:async args=>{scope=args.scope;return{};}}});assert.equal(scope,'global');await assert.rejects(signOutEverywhere({auth:{signOut:async()=>({error:Error('offline')})}}));});
test('CSP不允许内联脚本或eval，图片只放行实际用到的来源且保留本地预览',()=>{const s=readFileSync(new URL('../_headers',import.meta.url),'utf8');const scripts=s.match(/script-src ([^;]+)/)[1];assert(!scripts.includes('unsafe-'));const imgs=s.match(/img-src ([^;]+)/)[1];assert(!/https:([\s;]|$)/.test(imgs),'img-src 不能放开所有 https 来源');assert(imgs.includes("https://*.supabase.co"),'头像取自 Supabase Storage 公开地址');assert(imgs.includes("https://covers.openlibrary.org")&&imgs.includes("https://www.gutenberg.org"),'在线书库封面域名');assert(imgs.includes('blob:'),'本地文件预览仍需 blob:');});
test('发布页面无内联脚本及HTML事件处理器',()=>{for(const file of ['index.html','login.html','account.html','store.html','faq.html','memo.html','profile.html','space.html','reader.html','tools/index.html']){const s=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert(!/\son[a-z]+\s*=/i.test(s),file);for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=/.test(m[1]))assert.equal(m[2].trim(),'',file);}});
test('账号安全：重置密码邮件 60 秒动态倒计时冷却、防刷防重复提交与退出所有设备即时反馈',()=>{
 const js=readFileSync(new URL('../account.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../account.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../auth.css',import.meta.url),'utf8');
 assert(js.includes('startCooldown'),'必须包含动态倒计时冷却逻辑');
 assert(js.includes('stopCooldown'),'必须包含停止倒计时与复原按钮逻辑');
 assert(js.includes('restoreCooldown'),'必须包含离页/刷新后自动恢复倒计时逻辑');
 assert(js.includes('lanmao_account_reset_cooldown_'),'必须使用按用户隔离的本地冷却键名');
 assert(js.includes('秒后可重新发送'),'按钮需呈现秒级实时递减文案');
 assert(js.includes('发送修改密码邮件'),'冷却结束后需恢复初始文案');
 assert(js.includes('正在安全退出所有设备，请稍候…'),'退出所有设备需提供即时视觉反馈');
 assert(html.includes('id="account-reset-password"'),'页面必须包含重置密码按钮');
 assert(html.includes('id="account-signout-all"'),'页面必须包含退出所有设备按钮');
 assert(css.includes('#account-reset-password:disabled'),'样式必须包含按钮禁用置灰态');
});
test('账号安全：当前登录邮箱明示、发信目标指示、脱敏切换与身份信息安全卡片',()=>{
 const js=readFileSync(new URL('../account.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../account.html',import.meta.url),'utf8');
 const spaceCss=readFileSync(new URL('../space.css',import.meta.url),'utf8');
 // 检查 HTML 结构
 assert(html.includes('id="account-identity-card"'),'页面必须包含身份安全卡片');
 assert(html.includes('id="account-user-id"'),'必须包含 UID 展示元素');
 assert(html.includes('id="account-email"'),'必须包含当前账号邮箱展示元素');
 assert(html.includes('id="account-toggle-mask"'),'必须包含脱敏切换按钮');
 assert(html.includes('id="account-reset-email-preview"'),'重置密码提示中必须包含专属邮箱预览占位');
 // 检查 JS 脱敏与切换逻辑
 assert(js.includes('function maskEmail'),'必须实现邮箱脱敏算法函数');
 assert(js.includes('function updateEmailDisplay'),'必须包含邮箱显示与脱敏更新函数');
 assert(js.includes('account-toggle-mask'),'必须绑定脱敏按钮点击事件');
 assert(js.includes('account-user-id'),'初始化时需填入截断UID');
 // 检查 CSS 样式
 assert(spaceCss.includes('.account-identity-card'),'space.css 必须包含卡片基础样式');
 assert(spaceCss.includes('.account-mask-btn'),'space.css 必须包含脱敏切换按钮样式');
 assert(spaceCss.includes('body[data-theme="dark"] .account-identity-card'),'必须支持深色主题');
});
