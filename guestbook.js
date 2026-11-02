// Lanmao Space 留言板：Supabase 存储 + 店主审核后公开显示。
// 规则：登录用户才能提交；提交后 approved 默认 false，页面只读 approved
// 为 true 的留言；店主在 Supabase 后台把 approved 改成 true 才会公开。
// 访客填的邮箱只写入数据库，前端读取时不查 email 字段，页面上不显示。
// 所有用户输入都用 textContent 渲染，不用 innerHTML 拼用户内容。
// 表还没建好时不让页面崩掉：显示提示，文字内容照常浏览。

import { getSupabase, isConfigured } from './lib/supabase-client.js';

const AVATAR_COLORS = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    "linear-gradient(135deg, #ffecd2, #fcb69f)"
];
const AVATAR_EMOJIS = ["🐱", "🐶", "🐰", "🐼", "🦊", "🐸", "🦉", "🐝", "🦋", "🐳", "🐨", "🐯"];

let supabase = null;
let lastSubmitAt = 0;

function hashString(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("zh-CN");
}

function setStatus(message) {
    const status = document.getElementById("guestbookStatus");
    if (status) status.textContent = message;
}

function renderMessages(messages) {
    const list = document.getElementById("messagesList");
    if (!list) return;
    list.replaceChildren();
    if (messages.length === 0) {
        const empty = document.createElement("p");
        empty.className = "guestbook-empty";
        empty.textContent = "还没有通过审核的留言，欢迎来做第一条留言～";
        list.append(empty);
        return;
    }
    for (const item of messages) {
        const hash = hashString(item.name || "");
        const row = document.createElement("div");
        row.className = "message-item";
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.style.background = AVATAR_COLORS[hash % AVATAR_COLORS.length];
        avatar.textContent = AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
        const content = document.createElement("div");
        content.className = "message-content";
        const header = document.createElement("div");
        header.className = "message-header";
        const name = document.createElement("span");
        name.className = "message-name";
        name.textContent = item.name;
        const time = document.createElement("span");
        time.className = "message-time";
        time.textContent = formatDate(item.created_at);
        header.append(name, time);
        const body = document.createElement("p");
        body.textContent = item.message;
        content.append(header, body);
        row.append(avatar, content);
        list.append(row);
    }
}

async function loadMessages() {
    const list = document.getElementById("messagesList");
    if (!list) return;
    try {
        const { data, error } = await supabase
            .from("guestbook_messages")
            .select("id, name, message, created_at")
            .eq("approved", true)
            .order("created_at", { ascending: false })
            .limit(50);
        if (error) throw error;
        renderMessages(data || []);
    } catch (error) {
        console.error(error);
        list.replaceChildren();
        const note = document.createElement("p");
        note.className = "guestbook-empty";
        note.textContent = "留言列表暂时读不出来，请刷新后再试；如果是刚上线，请店主先在 Supabase 运行 guestbook.sql。";
        list.append(note);
    }
}

async function init() {
    const form = document.getElementById("messageForm");
    if (!form) return;
    if (!isConfigured()) {
        setStatus("留言功能还没接好，请稍后再试。");
        return;
    }
    try {
        supabase = await getSupabase();
    } catch (error) {
        console.error(error);
        setStatus("留言功能暂时加载失败，请检查网络，刷新后再试。");
        return;
    }
    await loadMessages();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();
        if (!name || !message) return;
        if (name.length > 40) {
            setStatus("昵称太长了，请控制在 40 个字以内。");
            return;
        }
        if (message.length > 2000) {
            setStatus("留言太长了，请控制在 2000 个字以内。");
            return;
        }
        if (Date.now() - lastSubmitAt < 10000) {
            setStatus("提交太快了，请稍等一会儿再试。");
            return;
        }
        if (button) button.disabled = true;
        setStatus("正在提交…");
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData.session) {
                window.location.replace(`login.html?next=${encodeURIComponent(window.location.pathname)}`);
                return;
            }
            const { error } = await supabase.from("guestbook_messages").insert({
                user_id: sessionData.session.user.id,
                name,
                email: email || null,
                message
            });
            if (error) throw error;
            lastSubmitAt = Date.now();
            form.reset();
            setStatus("留言已提交，店主审核通过后才会公开显示，感谢你的留言！");
        } catch (error) {
            console.error(error);
            const text = String(error && error.message ? error.message : "");
            setStatus(
                text.includes("guestbook_messages")
                    ? "留言功能还没接好：请店主先在 Supabase 运行 guestbook.sql，之后再提交。"
                    : "提交失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。"
            );
        } finally {
            if (button) button.disabled = false;
        }
    });
}

init();

document.addEventListener('guestbook-reviewed', () => { if (supabase) loadMessages(); });
