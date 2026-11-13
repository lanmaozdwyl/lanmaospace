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
// 点赞状态按留言 id 索引；guestbook-likes.sql 还没跑时 likesAvailable 会被置 false，
// 整条列表照常显示，只是不出现点赞按钮（不是报错，也不是点了没反应）。
const likeIndex = new Map();
let likesAvailable = true;

// 动效曲线取自参考站的动画词汇表：pop 用带过冲的 (.34,1.56,.64,1)，
// 位移/淡入用全站统一的 (.22,1,.36,1)，时长 .42s/.22s/.16s。
// 只在 Web Animations API 上做，不写内联样式、不加 class 再手动摘除——
// 反复点同一条时，重放动画靠的是新的 animate() 调用，而不是重置样式。
const EASE_POP = "cubic-bezier(.34,1.56,.64,1)";
const EASE_OUT = "cubic-bezier(.22,1,.36,1)";

function motionAllowed() {
    return !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playLikeMotion(button) {
    if (!motionAllowed()) return;
    const icon = button.querySelector(".guestbook-like-icon");
    if (icon?.animate) {
        icon.animate(
            [{ transform: "scale(.8)", opacity: 0 }, { transform: "scale(1.06)", opacity: 1 }, { transform: "scale(1)" }],
            { duration: 420, easing: EASE_POP }
        );
    }
    if (!button.animate || button.dataset.busy === "ring") return;
    // 一次性扩散环：append 一个空 span，动画结束自己摘掉，不留 DOM 垃圾。
    const ring = document.createElement("span");
    ring.className = "guestbook-like-ring";
    ring.setAttribute("aria-hidden", "true");
    button.append(ring);
    button.dataset.busy = "ring";
    ring.animate(
        [{ transform: "scale(.55)", opacity: 0.55 }, { transform: "scale(2)", opacity: 0 }],
        { duration: 520, easing: EASE_OUT }
    ).onfinish = () => { ring.remove(); delete button.dataset.busy; };
}

function likeLabel(liked, count) {
    return `${count} 赞 · ${liked ? "已点赞" : "点赞"}`;
}

function renderLikeButton(item) {
    const state = likeIndex.get(item.id);
    if (!likesAvailable || !state) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "guestbook-like";
    button.dataset.id = item.id;
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.setAttribute("aria-label", likeLabel(state.liked, state.count));
    const icon = document.createElement("span");
    icon.className = "guestbook-like-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = state.liked ? "♥" : "♡";
    const count = document.createElement("span");
    count.className = "guestbook-like-count";
    count.textContent = state.count;
    button.append(icon, count);
    return button;
}

// 就地更新一张卡片，不重刷整个列表：重刷会把滚动位置顶回顶部。
// moveCount 控制数字要不要滑一下——只有状态真的变了才该动，服务端回填纠偏时不再动第二次。
function applyLikeState(id, state, button, moveCount = false) {
    likeIndex.set(id, state);
    if (!button) return;
    const icon = button.querySelector(".guestbook-like-icon");
    const count = button.querySelector(".guestbook-like-count");
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.setAttribute("aria-label", likeLabel(state.liked, state.count));
    if (icon) icon.textContent = state.liked ? "♥" : "♡";
    if (count) {
        count.textContent = state.count;
        if (moveCount && motionAllowed() && count.animate) {
            count.animate(
                [{ transform: "translateY(6px)", opacity: 0 }, { transform: "none", opacity: 1 }],
                { duration: 220, easing: EASE_OUT }
            );
        }
    }
}

async function loadLikeState() {
    try {
        const { data, error } = await supabase.rpc("guestbook_like_state");
        if (error) throw error;
        likeIndex.clear();
        for (const row of data || []) {
            likeIndex.set(row.id, { count: Number(row.like_count), liked: row.liked_by_me === true });
        }
        likesAvailable = true;
    } catch (error) {
        // 多半是 guestbook-likes.sql 还没在 Supabase 跑。整排按钮收起来，
        // 比留下一个点了必然报错的心形好。
        console.error("guestbook_like_state unavailable, hiding like buttons", error);
        likesAvailable = false;
        likeIndex.clear();
    }
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
        const like = renderLikeButton(item);
        if (like) {
            const actions = document.createElement("div");
            actions.className = "message-actions";
            actions.append(like);
            content.append(actions);
        }
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
        await loadLikeState();
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
        // 回退查表时列表里没有头像字段，但 id 是对的，点赞状态照样能并上去。
        await loadLikeState();
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

    // 事件委托：列表每次刷新都整体 replaceChildren，逐条绑监听会越绑越多。
    const list = document.getElementById("messagesList");
    list?.addEventListener("click", async (event) => {
        const button = event.target.closest?.(".guestbook-like");
        if (!button || button.dataset.pending === "1") return;
        const id = button.dataset.id;
        const before = likeIndex.get(id);
        if (!before) return;
        // 先占位再 await：取会话也是一次异步，两连点若都跑到会话检查那儿，
        // 就会并发出两个请求，后回来的覆盖掉先回来的，显示的状态和最后一次点击相反。
        button.dataset.pending = "1";
        button.disabled = true;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
                // 和提交留言不同，点赞不该把人整页带走：误点心形就把人踢到登录页太粗暴。
                setStatus("登录后就能给留言点赞了。");
                return;
            }
            const next = { count: Math.max(0, before.count + (before.liked ? -1 : 1)), liked: !before.liked };
            applyLikeState(id, next, button, true);
            if (next.liked) playLikeMotion(button);
            const { data, error } = await supabase.rpc("guestbook_set_like", {
                p_message_id: id,
                p_liked: next.liked
            });
            if (error) throw error;
            const row = (data || [])[0];
            if (!row) throw new Error("guestbook_set_like 没返回计数");
            applyLikeState(id, { count: Number(row.like_count), liked: row.liked_by_me === true }, button);
        } catch (error) {
            console.error(error);
            // 服务端没收下就把票数还回去，不能让页面显示一个不存在的赞。
            applyLikeState(id, before, button, true);
            setStatus("点赞没存上，请检查网络后再点一次。");
        } finally {
            delete button.dataset.pending;
            button.disabled = false;
        }
    });

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
