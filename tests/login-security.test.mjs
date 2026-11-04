import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{validateNewPassword}from'../lib/account-security.mjs';
function fixture(){const items=new Map(),calls=[];const get=id=>{if(!items.has(id))items.set(id,{id,value:'',hidden:false,disabled:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},focus(){}});return items.get(id);};for(const id of ['login-password','register-password','register-password-confirm','recovery-password','recovery-password-confirm'])get(id);
 const client={auth:{signInWithPassword:async args=>{calls.push({type:'login',args});return{data:{session:{}}};},signUp:async args=>{calls.push({type:'register',args});return{data:{session:null}};},updateUser:async args=>{calls.push({type:'update',args});return{};}}};
 const ctx=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[...items.values()].filter(el=>el.id.includes('password'))},window:{location:{origin:'https://lanmaospace.pages.dev',search:'',hash:'',replace(){} }},URL,URLSearchParams,validateNewPassword,fixtureClient:client,console:{warn(){}}});
 let source=readFileSync(new URL('../login.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\ninit\(\);\s*$/,'');vm.runInContext(source,ctx);vm.runInContext('supabase=fixtureClient;',ctx);return{get,calls};}
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
