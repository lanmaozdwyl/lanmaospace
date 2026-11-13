// 留言板点赞的前端行为。guestbook.js 是真模块，这里用 vm + 一套最小假 DOM 跑起来，
// 因为字符串断言只能证明"代码里写过这句话"，证不了点一下数字真的会变、失败真的会退回去。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../guestbook.js', import.meta.url), 'utf8')
    .replace(/^import .*from ['"]\.\/lib\/supabase-client\.js['"];?$/m, '')
    .replace(/^import .*from ['"]\.\/lib\/avatar\.mjs['"];?$/m, '');

class El {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.childNodes = this.children;
        this.textContent = '';
        this.style = {};
        this.className = '';
        this.dataset = {};
        this.attrs = {};
        this.listeners = {};
        this.disabled = false;
        this.hidden = false;
        this.value = '';
        this.parent = null;
    }
    get textContent() {
        return this.children.length ? this.children.map(child => child.textContent).join(' ') : this._text ?? '';
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    append(...items) {
        for (const item of items) { item.parent = this; this.children.push(item); }
    }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    get classList() {
        const owner = this;
        return {
            toggle: (name, force) => {
                const on = force === undefined ? !owner.matches(`.${name}`) : Boolean(force);
                if (on) owner.className = `${owner.className} ${name}`.trim();
                else owner.className = owner.className.split(/\s+/).filter(c => c && c !== name).join(' ');
            },
            add: name => owner.classList.toggle(name, true),
            contains: name => owner.matches(`.${name}`),
        };
    }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name]; }
    closest(selector) {
        let node = this;
        while (node) {
            if (node.className.split(' ').includes(selector.replace('.', ''))) return node;
            node = node.parent;
        }
        return null;
    }
    matches(selector) { return this.className.split(' ').includes(selector.replace('.', '')); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
        const out = [];
        const walk = node => {
            for (const child of node.children) {
                if (child.matches?.(selector)) out.push(child);
                walk(child);
            }
        };
        walk(this);
        return out;
    }
    // 真 DOM 的 click 会冒泡，点赞用的是 #messagesList 上的事件委托；假 DOM 不冒泡
    // 就会让"点一下没反应"这类 bug 悄悄过关，所以这里必须一路往上传。
    async fire(name, event = {}) {
        const evt = { target: event.target || this, ...event };
        evt.target = event.target || this;
        let node = this;
        while (node) {
            for (const fn of node.listeners?.[name] || []) await fn(evt);
            node = node.parent;
        }
    }
}

function fixture({ messages, likeState, likeError = null, setLikeError = null, session = { user: { id: 'guest' } }, reduceMotion = false }) {
    const ids = {};
    const calls = [];
    const animateCount = { value: 0 };
    const make = tag => { const el = new El(tag); return el; };
    const list = make('div');
    const status = make('p');
    ids.messagesList = list;
    ids.guestbookStatus = status;
    ids.messageForm = make('form');
    ids.name = make('input');
    ids.email = make('input');
    ids.message = make('textarea');
    ids.guestbookCharCount = make('span');

    const client = {
        auth: { getSession: async () => ({ data: { session } }) },
        // 回退查表用的链式 builder：只有 guestbook_public_list 不可用时才会走到这里。
        from: () => {
            const builder = { eq: () => builder, order: () => builder, limit: () => builder };
            builder.select = () => Promise.resolve({ data: messages, error: null });
            builder.insert = () => Promise.resolve({ error: null });
            return builder;
        },
        rpc: async (name, args) => {
            // 摊平一份再记：args 是 vm 里造的对象，原型跟本 realm 不同，
            // deepStrictEqual 会因"不是同一个 Object.prototype"判定不等。
            calls.push({ name, args: { ...args } });
            if (name === 'guestbook_public_list') return { data: messages };
            if (name === 'guestbook_like_state') {
                if (likeError) throw new Error('function public.guestbook_like_state() does not exist');
                return { data: likeState };
            }
            if (name === 'guestbook_set_like') {
                if (setLikeError) throw new Error(setLikeError);
                return { data: args.p_liked ? [{ like_count: 1, liked_by_me: true }] : [{ like_count: 0, liked_by_me: false }] };
            }
            throw new Error(`unexpected rpc ${name}`);
        }
    };
    const store = new Map();
    const logs = [];
    const ctx = vm.createContext({
        document: {
            getElementById: id => ids[id] || null,
            createElement: make,
            addEventListener: () => {},
            querySelectorAll: () => [],
            querySelector: () => null,
        },
        window: { location: { pathname: '/index.html', replace: () => {} } },
        localStorage: {
            getItem: key => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: key => store.delete(key),
        },
        matchMedia: query => ({ matches: query.includes('reduce') && reduceMotion, addEventListener: () => {} }),
        getSupabase: async () => client,
        isConfigured: () => true,
        avatarDisplay: () => ({ type: 'emoji', emoji: '🐱', color: '#eee' }),
        avatarPublicUrl: () => 'https://example.invalid/a.png',
        fallbackAvatarDisplay: () => ({ type: 'emoji', emoji: '🙂', color: '#ddd' }),
        encodeURIComponent,
        console: { error: (...args) => logs.push(args.map(String).join(' ')), warn: () => {}, log: () => {} },
        setTimeout: fn => fn(),
        setInterval: () => 0,
        clearTimeout: () => {},
        Date,
        Event: class {},
        Set,
        Map,
        Intl,
        animateCounter: animateCount,
    });
    // animate() 只在元素上兜底实现，方便数调用次数、并保证 onfinish 不会自己把环摘掉。
    El.prototype.animate = function () {
        ctx.animateCounter.value += 1;
        return { finish() {} };
    };
    return { ids, list, status, calls, animateCount, logs, ctx };
}

async function boot(options) {
    const f = fixture(options);
    await vm.runInContext(`(async()=>{${source}\n})()`, f.ctx);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    return f;
}

const MESSAGE = [{ id: 'm1', name: '小蓝', message: '第一条留言', created_at: '2026-11-01T00:00:00Z' }];

test('点赞状态可用时，每条留言右下角出现一个按钮，带计数与按下状态', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 3, liked_by_me: false }] });
    const button = f.list.querySelector('.guestbook-like');
    assert.ok(button, '没有渲染点赞按钮');
    assert.equal(button.attrs['aria-pressed'], 'false');
    assert.equal(button.querySelector('.guestbook-like-count').textContent, '3');
    assert.equal(button.dataset.id, 'm1');
});

test('guestbook_like_state 不存在时收起按钮，留言照常显示且不报错', async () => {
    const f = await boot({ messages: MESSAGE, likeState: null, likeError: true });
    assert.equal(f.list.querySelector('.guestbook-like'), null, '迁移没跑却还是画了按钮');
    assert.ok(f.list.textContent.includes('第一条留言'), '留言正文应该照常渲染');
});

test('点一下：数字先乐观加一、放动画，服务端回来后按真实计数收尾', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 0, liked_by_me: false }] });
    const button = f.list.querySelector('.guestbook-like');
    const before = f.animateCount.value;
    await button.fire('click', { target: button });
    const call = f.calls.find(c => c.name === 'guestbook_set_like');
    assert.deepEqual(call.args, { p_message_id: 'm1', p_liked: true });
    assert.equal(button.querySelector('.guestbook-like-count').textContent, '1');
    assert.equal(button.attrs['aria-pressed'], 'true');
    assert.equal(button.querySelector('.guestbook-like-icon').textContent, '♥');
    assert.ok(f.animateCount.value > before, '点赞没有触发任何动画');
    assert.ok(button.children.some(child => child.className === 'guestbook-like-ring'), '没有加扩散环');
});

test('服务端拒绝时把数字退回去，不能让页面挂着一个不存在的赞', async () => {
    const f = await boot({
        messages: MESSAGE,
        likeState: [{ id: 'm1', like_count: 7, liked_by_me: false }],
        setLikeError: 'new row violates row-level security policy'
    });
    const button = f.list.querySelector('.guestbook-like');
    await button.fire('click', { target: button });
    assert.equal(button.querySelector('.guestbook-like-count').textContent, '7', '乐观加一之后没退回去');
    assert.equal(button.attrs['aria-pressed'], 'false');
    assert.equal(button.querySelector('.guestbook-like-icon').textContent, '♡');
    assert.match(f.status.textContent, /点赞没存上/);
    assert.equal(button.disabled, false, '请求结束后按钮要恢复可用');
});

test('同一条留言连点两次不会并发发两个请求', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 0, liked_by_me: false }] });
    const button = f.list.querySelector('.guestbook-like');
    const first = button.fire('click', { target: button });
    await button.fire('click', { target: button });
    await first;
    assert.equal(f.calls.filter(c => c.name === 'guestbook_set_like').length, 1,
        '第一次请求还没回来就放行了第二次，会互相覆盖计数');
});

test('未登录点赞不做请求，只提示去登录，也不把人整页带走', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 2, liked_by_me: false }], session: null });
    const button = f.list.querySelector('.guestbook-like');
    await button.fire('click', { target: button });
    assert.equal(f.calls.some(c => c.name === 'guestbook_set_like'), false, '未登录却调了点赞接口');
    assert.match(f.status.textContent, /登录后/);
    assert.equal(button.querySelector('.guestbook-like-count').textContent, '2', '未登录不该改数字');
});

test('prefers-reduced-motion 下不改数字位置、不加扩散环', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 0, liked_by_me: false }], reduceMotion: true });
    const button = f.list.querySelector('.guestbook-like');
    await button.fire('click', { target: button });
    assert.equal(f.animateCount.value, 0, '减弱动效偏好下仍然播了动画');
    assert.equal(button.children.some(child => child.className === 'guestbook-like-ring'), false);
    assert.equal(button.querySelector('.guestbook-like-count').textContent, '1', '状态本身还是要更新');
});

test('列表整体刷新用事件委托，不给每张卡片单独绑监听', async () => {
    const f = await boot({ messages: MESSAGE, likeState: [{ id: 'm1', like_count: 1, liked_by_me: false }] });
    assert.ok(f.list.listeners.click?.length === 1, '消息列表上应当只有一个 click 委托');
    assert.equal(f.list.querySelector('.guestbook-like').listeners.click, undefined);
});
