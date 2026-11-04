// Lanmao Space 留言板：Supabase 存储 + 店主审核后公开显示。
// 规则：登录用户才能提交；提交后 approved 默认 false，页面只读 approved
// 为 true 的留言；店主在 Supabase 后台把 approved 改成 true 才会公开。
// 访客填的邮箱只写入数据库，前端读取时不查 email 字段，页面上不显示。
// 头像不直接查 profiles 表：guestbook_public_list 函数只返回已通过审核的
// 留言 + 头像字段，不暴露 user_id / 邮箱；函数不存在时回退查表 + 默认头像。
// 所有用户输入都用 textContent 渲染，不用 innerHTML 拼用户内容。
// 表还没建好时不让页面崩掉：显示提示，文字内容照常浏览。

import { getSupabase, isConfigured } from './lib/supabase-client.js';
import { avatarDisplay, avatarPublicUrl, fallbackAvatarDisplay } from './lib/avatar.mjs';

let supabase = null;
let lastSubmitAt = 0;

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
        const display = avatarDisplay(item) || fallbackAvatarDisplay(item.name || "");
        const row = document.createElement("div");
        row.className = "message-item";
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        if (display.type === "image") {
            const img = document.createElement("img");
            img.src = avatarPublicUrl(supabase, display.path);
            img.alt = "";
            img.loading = "lazy";
            avatar.append(img);
        } else {
            avatar.style.background = display.color;
            avatar.textContent = display.emoji;
        }
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
    // 首选公开列表函数：只返回已通过审核的留言 + 头像，不暴露 user_id / 邮箱。
    // 函数还没建好（avatars.sql 未运行）时回退直接查表，头像用默认 emoji。
    try {
        const { data, error } = await supabase.rpc("guestbook_public_list");
        if (error) throw error;
        renderMessages(data || []);
        return;
    } catch (error) {
        console.error("guestbook_public_list unavailable, falling back to table select", error);
    }
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

const STORAGE_KEY_GUESTBOOK_DRAFT = 'lanmao_guestbook_draft_v1';

function initGuestbookEnhancements() {
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const messageInput = document.getElementById("message");
    const countEl = document.getElementById("guestbookCharCount");
    const draftNotice = document.getElementById("guestbookDraftNotice");
    const retryBtn = document.getElementById("guestbookRetryBtn");
    const quickTags = document.querySelectorAll(".quick-tag-pill");

    function updateCharCount() {
        if (!messageInput || !countEl) return;
        const len = messageInput.value.length;
        countEl.textContent = `${len} / 2000`;
        countEl.classList.toggle("near-limit", len >= 1900 && len <= 2000);
        countEl.classList.toggle("over-limit", len > 2000);
    }

    function saveDraft() {
        try {
            const nameVal = nameInput ? nameInput.value.trim() : "";
            const emailVal = emailInput ? emailInput.value.trim() : "";
            const msgVal = messageInput ? messageInput.value : "";
            if (nameVal || emailVal || msgVal.trim()) {
                const payload = {
                    name: nameVal,
                    email: emailVal,
                    message: msgVal,
                    savedAt: Date.now()
                };
                localStorage.setItem(STORAGE_KEY_GUESTBOOK_DRAFT, JSON.stringify(payload));
            } else {
                localStorage.removeItem(STORAGE_KEY_GUESTBOOK_DRAFT);
            }
        } catch (_) {}
    }

    function clearDraft() {
        try {
            localStorage.removeItem(STORAGE_KEY_GUESTBOOK_DRAFT);
            if (draftNotice) draftNotice.hidden = true;
            if (retryBtn) retryBtn.hidden = true;
        } catch (_) {}
    }

    function restoreDraft() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GUESTBOOK_DRAFT);
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== "object") return;
            let restored = false;
            if (draft.name && nameInput && !nameInput.value) {
                nameInput.value = draft.name;
                restored = true;
            }
            if (draft.email && emailInput && !emailInput.value) {
                emailInput.value = draft.email;
                restored = true;
            }
            if (draft.message && messageInput && !messageInput.value) {
                messageInput.value = draft.message;
                restored = true;
            }
            if (restored) {
                updateCharCount();
                if (draftNotice) {
                    draftNotice.hidden = false;
                    setTimeout(() => {
                        if (draftNotice) draftNotice.hidden = true;
                    }, 4500);
                }
            }
        } catch (_) {}
    }

    if (nameInput) nameInput.addEventListener("input", saveDraft);
    if (emailInput) emailInput.addEventListener("input", saveDraft);
    if (messageInput) {
        messageInput.addEventListener("input", () => {
            updateCharCount();
            saveDraft();
        });
    }

    restoreDraft();
    updateCharCount();

    quickTags.forEach(pill => {
        pill.addEventListener("click", () => {
            if (!messageInput) return;
            const textToAdd = pill.dataset.msg || pill.textContent;
            if (!messageInput.value.trim()) {
                messageInput.value = textToAdd;
            } else {
                messageInput.value = messageInput.value.trim() + "\n" + textToAdd;
            }
            messageInput.focus();
            updateCharCount();
            saveDraft();
        });
    });

    return { updateCharCount, saveDraft, clearDraft };
}

async function init() {
    const form = document.getElementById("messageForm");
    if (!form) return;
    const { updateCharCount, saveDraft, clearDraft } = initGuestbookEnhancements();
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
        const retryBtn = document.getElementById("guestbookRetryBtn");
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
        if (retryBtn) retryBtn.hidden = true;
        setStatus("正在提交…");
        saveDraft();
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData.session) {
                saveDraft();
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
            clearDraft();
            form.reset();
            updateCharCount();
            setStatus("留言已提交，店主审核通过后才会公开显示，感谢你的留言！");
        } catch (error) {
            console.error(error);
            saveDraft();
            const text = String(error && error.message ? error.message : "");
            setStatus(
                text.includes("guestbook_messages")
                    ? "留言功能还没接好：请店主先在 Supabase 运行 guestbook.sql，之后再提交。"
                    : "提交失败，已为你妥善保存草稿，请检查网络后点击【重试发送】。"
            );
            if (retryBtn) {
                retryBtn.hidden = false;
                retryBtn.onclick = () => {
                    retryBtn.hidden = true;
                    if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit();
                    } else {
                        form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                };
            }
        } finally {
            if (button) button.disabled = false;
        }
    });
}

init();

document.addEventListener('guestbook-reviewed', () => { if (supabase) loadMessages(); });
