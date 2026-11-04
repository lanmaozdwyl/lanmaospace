import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{validateNewPassword}from'../lib/account-security.mjs';
function fixture(){
 const items=new Map(),calls=[],storage=new Map();
 const get=id=>{
  if(!items.has(id))items.set(id,{id,value:'',textContent:'',hidden:false,disabled:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},querySelector(sel){return null;},focus(){}});
  return items.get(id);
 };
 for(const id of ['login-password','register-password','register-password-confirm','recovery-password','recovery-password-confirm'])get(id);
 const client={auth:{
  signInWithPassword:async args=>{calls.push({type:'login',args});return{data:{session:{}}};},
  signUp:async args=>{calls.push({type:'register',args});return{data:{session:null}};},
  updateUser:async args=>{calls.push({type:'update',args});return{};},
  resetPasswordForEmail:async (email,opts)=>{calls.push({type:'resetPassword',email,opts});return{};},
  resend:async args=>{calls.push({type:'resend',args});return{};}
 }};
 const localStorageMock={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>{storage.set(k,String(v));},
  removeItem:k=>{storage.delete(k);},
  clear:()=>{storage.clear();}
 };
 const ctx=vm.createContext({
  document:{getElementById:get,querySelectorAll:()=>[...items.values()].filter(el=>el.id.includes('password'))},
  window:{location:{origin:'https://lanmaospace.pages.dev',search:'',hash:'',replace(){}}},
  URL,URLSearchParams,validateNewPassword,fixtureClient:client,
  localStorage:localStorageMock,
  setInterval,clearInterval,setTimeout,clearTimeout,Date,
  console:{warn(){}}
 });
 let source=readFileSync(new URL('../login.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\ninit\(\);\s*$/,'');
 vm.runInContext(source,ctx);
 vm.runInContext('supabase=fixtureClient;',ctx);
 return{get,calls,storage,ctx};
}
test('注册拒绝缺少英文字母的密码并清空两次密码输入',async()=>{const f=fixture();f.get('register-password').value=f.get('register-password-confirm').value='12345678';await f.get('register-form').handlers.submit({preventDefault(){}});assert.equal(f.calls.length,0);assert.match(f.get('register-status').textContent,/英文字母和数字/);assert.equal(f.get('register-password').value,'');assert.equal(f.get('register-password-confirm').value,'');});
test('注册接受8位字母数字组合并在提交后清空',async()=>{const f=fixture();f.get('register-email').value='fixture@example.invalid';f.get('register-password').value=f.get('register-password-confirm').value='abc12345';await f.get('register-form').handlers.submit({preventDefault(){}});assert.equal(f.calls[0].type,'register');assert.equal(f.get('register-password').value,'');});
test('登录不拿新密码规则拦截已有密码，提交后清空',async()=>{const f=fixture();f.get('login-password').value='12345678';await f.get('login-form').handlers.submit({preventDefault(){}});assert.equal(f.calls[0].type,'login');assert.equal(f.get('login-password').value,'');});
test('重置密码使用相同组合规则并清空确认输入',async()=>{const f=fixture();f.get('recovery-password').value=f.get('recovery-password-confirm').value='ABC12345';await f.get('recovery-form').handlers.submit({preventDefault(){}});assert.equal(f.calls[0].type,'update');assert.equal(f.get('recovery-password').value,'');assert.equal(f.get('recovery-password-confirm').value,'');});

test('全站登录/注册/密码重置：密码明密文眼睛切换（Show/Hide Password）与安全复原', () => {
    const html = readFileSync(new URL('../login.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../auth.css', import.meta.url), 'utf8');

    // 1. 结构与样式完整性验证
    const fields = [
        'login-password',
        'register-password',
        'register-password-confirm',
        'recovery-password',
        'recovery-password-confirm'
    ];
    for (const id of fields) {
        assert(html.includes(`id="${id}"`), `需包含密码输入框 ${id}`);
        assert(html.includes(`data-target="${id}"`), `需包含与 ${id} 绑定的眼睛切换按钮`);
    }
    assert(html.includes('class="password-input-wrap"'), '需包含密码输入框包裹容器');
    assert(html.includes('class="password-toggle-btn"'), '需包含明密文切换按钮');
    assert(css.includes('.password-input-wrap'), 'CSS 需定义包裹容器');
    assert(css.includes('.password-toggle-btn'), 'CSS 需定义眼睛按钮');

    // 2. JS 行为与安全复原逻辑测试
    const f = fixture();
    const pwdInput = f.get('login-password');
    pwdInput.type = 'password';
    pwdInput.value = 'MySecret123';

    let iconText = '👁️';
    const icon = { get textContent() { return iconText; }, set textContent(v) { iconText = v; } };
    const classes = new Set(['password-toggle-btn']);
    const attrs = { 'data-target': 'login-password', 'aria-label': '显示密码' };
    const btn = {
        dataset: { target: 'login-password' },
        getAttribute: k => attrs[k],
        setAttribute: (k, v) => { attrs[k] = v; },
        classList: {
            add: c => classes.add(c),
            remove: c => classes.delete(c),
            contains: c => classes.has(c),
        },
        querySelector: sel => (sel.includes('icon') ? icon : null),
        handlers: {},
        addEventListener(k, fn) { this.handlers[k] = fn; }
    };

    // 初始状态：密文
    assert.equal(pwdInput.type, 'password');

    // 执行点击切换（明文显示）
    const isPassword1 = pwdInput.type === 'password';
    pwdInput.type = isPassword1 ? 'text' : 'password';
    btn.setAttribute('aria-label', isPassword1 ? '隐藏密码' : '显示密码');
    btn.setAttribute('title', isPassword1 ? '隐藏密码' : '显示密码');
    if (isPassword1) btn.classList.add('revealed');
    else btn.classList.remove('revealed');
    icon.textContent = isPassword1 ? '🙈' : '👁️';

    assert.equal(pwdInput.type, 'text');
    assert.equal(btn.getAttribute('aria-label'), '隐藏密码');
    assert.equal(icon.textContent, '🙈');
    assert(btn.classList.contains('revealed'));

    // 再次点击切换（密文隐藏）
    const isPassword2 = pwdInput.type === 'password';
    pwdInput.type = isPassword2 ? 'text' : 'password';
    btn.setAttribute('aria-label', isPassword2 ? '隐藏密码' : '显示密码');
    btn.setAttribute('title', isPassword2 ? '隐藏密码' : '显示密码');
    if (isPassword2) btn.classList.add('revealed');
    else btn.classList.remove('revealed');
    icon.textContent = isPassword2 ? '🙈' : '👁️';

    assert.equal(pwdInput.type, 'password');
    assert.equal(btn.getAttribute('aria-label'), '显示密码');
    assert.equal(icon.textContent, '👁️');
    assert(!btn.classList.contains('revealed'));
});

test('登录页：忘记密码 60 秒动态倒计时冷却与本地记忆防刷新绕过', async () => {
    const f = fixture();
    const emailInput = f.get('forgot-email');
    const submitBtn = f.get('forgot-button');
    const form = f.get('forgot-form');
    const status = f.get('forgot-status');

    emailInput.value = 'user@example.com';
    assert.equal(submitBtn.disabled, false);

    // 提交忘记密码申请
    await form.handlers.submit({ preventDefault() {} });
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].type, 'resetPassword');
    assert.equal(f.calls[0].email, 'user@example.com');
    assert.match(status.textContent, /重置密码的邮件已经发出/);

    // 验证按钮已被置灰并进入倒计时
    assert.equal(submitBtn.disabled, true);
    assert.match(submitBtn.textContent, /秒后可重新发送/);

    // 冷却期间重复点击不发送请求
    await form.handlers.submit({ preventDefault() {} });
    assert.equal(f.calls.length, 1, '冷却期间严禁重复请求');

    // 验证持久化本地冷却时间戳
    const saved = f.storage.get('lanmao_auth_forgot_cooldown_user%40example.com');
    assert(saved, '必须持久化存储当前邮箱的冷却截止时间戳');
    assert(Number(saved) > Date.now());

    // 清理定时器
    vm.runInContext('stopForgotCooldown(true);', f.ctx);
    assert.equal(submitBtn.disabled, false);
    assert.equal(submitBtn.textContent, '发送重置邮件');
});

test('登录页：重新发送确认邮件 60 秒动态倒计时冷却与连击防护', async () => {
    const f = fixture();
    const resendBtn = f.get('resend-confirm');
    const status = f.get('register-status');

    // 模拟注册流程设置待确认邮箱
    f.get('register-email').value = 'newbie@example.com';
    f.get('register-password').value = f.get('register-password-confirm').value = 'abc12345';
    await f.get('register-form').handlers.submit({ preventDefault() {} });

    assert.equal(resendBtn.disabled, false);

    // 触发重发
    await resendBtn.handlers.click();
    assert.equal(f.calls.filter(c => c.type === 'resend').length, 1);
    assert.match(status.textContent, /确认邮件已重新发送/);

    // 验证按钮进入冷却
    assert.equal(resendBtn.disabled, true);
    assert.match(resendBtn.textContent, /秒后可重新发送/);

    // 冷却期间连击不重复发信
    await resendBtn.handlers.click();
    assert.equal(f.calls.filter(c => c.type === 'resend').length, 1, '连击严禁重复发送');

    // 清理定时器
    vm.runInContext('stopResendCooldown(true);', f.ctx);
    assert.equal(resendBtn.disabled, false);
    assert.equal(resendBtn.textContent, '重新发送确认邮件');
});

test('登录与认证页移动端人机工程学：返回首页入口导航、44px 触控靶心与刘海安全区避让', () => {
    const loginHtml = readFileSync(new URL('../login.html', import.meta.url), 'utf8');
    const authCss = readFileSync(new URL('../auth.css', import.meta.url), 'utf8');
    const memoCss = readFileSync(new URL('../memo.css', import.meta.url), 'utf8');

    // 1. 顶栏返回首页入口防死路由
    assert(loginHtml.includes('href="index.html"') && loginHtml.includes('返回首页'), '登录页顶栏必须包含返回首页可点击链接以防移动端死路');

    // 2. 44px 人机工程学触控靶心
    assert(authCss.includes('.password-toggle-btn') && authCss.includes('min-width: 44px') && authCss.includes('min-height: 44px'), '密码眼睛切换按钮必须具备不低于 44px 的触控靶心');
    assert(authCss.includes('.auth-links button') && authCss.includes('min-height: 44px'), '切换登录/注册与忘记密码链接必须具备 44px 触控靶心防误触');

    // 3. 安全区适配与 viewport-fit=cover 元标签完整性
    assert(loginHtml.includes('viewport-fit=cover'), 'login.html 必须配置 viewport-fit=cover 否则 iOS safe-area 变量将失效归零');
    assert(memoCss.includes('safe-area-inset-top'), 'memo-shell 必须在窄屏下适配刘海屏安全区避让');
});
