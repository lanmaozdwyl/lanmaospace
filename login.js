import {validateNewPassword} from './lib/account-security.mjs';
// Lanmao Space 全站登录页：登录、注册、忘记密码、重置密码都在这里。
// 访客可以自己注册邮箱账号；备忘录只认店主账号，那层检查在 memo.js 里。
// 密码只交给 Supabase Auth，从不在本站保存或写进仓库。

import { getSupabase, isConfigured, getConfigError } from './lib/supabase-client.js';

const $ = (id) => document.getElementById(id);

const panels = {
    login: $("login-panel"),
    register: $("register-panel"),
    forgot: $("forgot-panel"),
    recovery: $("recovery-panel")
};

let supabase = null;
let pendingConfirmEmail = "";

const STORAGE_PREFIX_FORGOT_COOLDOWN = 'lanmao_auth_forgot_cooldown_';
const STORAGE_KEY_RESEND_COOLDOWN = 'lanmao_auth_resend_cooldown';

let forgotCooldownTimer = null;
let resendCooldownTimer = null;
let forgotBusy = false;
let resendBusy = false;

function setButtonText(btn, text) {
    if (!btn) return;
    const span = btn.querySelector ? btn.querySelector('span') : null;
    if (span) span.textContent = text;
    else btn.textContent = text;
}

function stopForgotCooldown(resetText = true) {
    if (forgotCooldownTimer) {
        clearInterval(forgotCooldownTimer);
        forgotCooldownTimer = null;
    }
    const btn = $("forgot-button");
    if (btn && resetText) {
        setButtonText(btn, '发送重置邮件');
        if (!forgotBusy) btn.disabled = false;
    }
}

function startForgotCooldown(remainingSec, totalExpireMs, email) {
    stopForgotCooldown(false);
    const expireMs = totalExpireMs || (Date.now() + remainingSec * 1000);
    const storageKey = STORAGE_PREFIX_FORGOT_COOLDOWN + (email ? encodeURIComponent(email) : 'global');
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, String(expireMs));
    } catch {}
    const btn = $("forgot-button");
    function tick() {
        const now = Date.now();
        const left = Math.max(0, Math.ceil((expireMs - now) / 1000));
        if (left <= 0) {
            try {
                if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
            } catch {}
            stopForgotCooldown(true);
        } else {
            if (btn) {
                setButtonText(btn, left + ' 秒后可重新发送');
                btn.disabled = true;
            }
        }
    }
    tick();
    forgotCooldownTimer = setInterval(tick, 1000);
}

function restoreForgotCooldown() {
    const inputEmail = $("forgot-email")?.value?.trim()?.toLowerCase() || '';
    const storageKey = STORAGE_PREFIX_FORGOT_COOLDOWN + (inputEmail ? encodeURIComponent(inputEmail) : 'global');
    try {
        if (typeof localStorage === 'undefined') return;
        const saved = localStorage.getItem(storageKey) || localStorage.getItem(STORAGE_PREFIX_FORGOT_COOLDOWN + 'global');
        if (saved) {
            const expireMs = Number(saved);
            const left = Math.max(0, Math.ceil((expireMs - Date.now()) / 1000));
            if (left > 0 && left <= 60) {
                startForgotCooldown(left, expireMs, inputEmail);
            } else {
                localStorage.removeItem(storageKey);
                stopForgotCooldown(true);
            }
        } else {
            stopForgotCooldown(true);
        }
    } catch {}
}

function stopResendCooldown(resetText = true) {
    if (resendCooldownTimer) {
        clearInterval(resendCooldownTimer);
        resendCooldownTimer = null;
    }
    const btn = $("resend-confirm");
    if (btn && resetText) {
        setButtonText(btn, '重新发送确认邮件');
        if (!resendBusy) btn.disabled = false;
    }
}

function startResendCooldown(remainingSec, totalExpireMs) {
    stopResendCooldown(false);
    const expireMs = totalExpireMs || (Date.now() + remainingSec * 1000);
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_RESEND_COOLDOWN, String(expireMs));
    } catch {}
    const btn = $("resend-confirm");
    function tick() {
        const now = Date.now();
        const left = Math.max(0, Math.ceil((expireMs - now) / 1000));
        if (left <= 0) {
            try {
                if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY_RESEND_COOLDOWN);
            } catch {}
            stopResendCooldown(true);
        } else {
            if (btn) {
                setButtonText(btn, left + ' 秒后可重新发送');
                btn.disabled = true;
            }
        }
    }
    tick();
    resendCooldownTimer = setInterval(tick, 1000);
}

function restoreResendCooldown() {
    try {
        if (typeof localStorage === 'undefined') return;
        const saved = localStorage.getItem(STORAGE_KEY_RESEND_COOLDOWN);
        if (saved) {
            const expireMs = Number(saved);
            const left = Math.max(0, Math.ceil((expireMs - Date.now()) / 1000));
            if (left > 0 && left <= 60) {
                startResendCooldown(left, expireMs);
            } else {
                localStorage.removeItem(STORAGE_KEY_RESEND_COOLDOWN);
                stopResendCooldown(true);
            }
        } else {
            stopResendCooldown(true);
        }
    } catch {}
}

function showOnly(name) {
    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
    }
    if (name === "forgot") {
        restoreForgotCooldown();
    } else if (name === "register") {
        restoreResendCooldown();
    }
}

function safeNext() {
    const raw = new URLSearchParams(window.location.search).get("next") || "";
    if (!raw) return "index.html";
    let parsed;
    try {
        parsed = new URL(raw, window.location.origin);
    } catch {
        return "index.html";
    }
    if (parsed.origin !== window.location.origin) return "index.html";
    const allowed = ["/", "/index", "/index.html", "/store", "/store.html", "/memo", "/memo.html", "/tools", "/tools/", "/tools/index.html", "/profile", "/profile.html", "/faq", "/faq.html", "/space", "/space.html", "/account", "/account.html", "/reader", "/reader.html"];
    if (!allowed.includes(parsed.pathname)) return "index.html";
    return parsed.pathname + parsed.search + parsed.hash;
}

function goNext() {
    window.location.replace(safeNext());
}

function authErrorMessage(error) {
    const message = String(error && error.message ? error.message : "");
    if (message.startsWith("新密码") || message.startsWith("密码请控制")) return message;
    if (message.includes("Invalid login credentials")) return "邮箱或密码不对，请再试一次。";
    if (message.includes("Email not confirmed")) return "这个邮箱还没有确认，请先点确认邮件里的链接，再回来登录。";
    if (message.includes("User already registered")) return "这个邮箱已经注册过了，请直接登录。";
    if (message.includes("Signups not allowed")) return "注册暂时没有打开，请联系店主在 Supabase 后台打开注册后再试。";
    if (message.includes("Password should be at least")) return "新密码至少需要 8 位并包含英文字母和数字，请按要求重试。";
    if (message.includes("Unable to validate email address")) return "这个邮箱地址看起来不对，请检查后再试。";
    if (message.includes("For security purposes")) return "尝试太频繁了，请稍等一会儿再试。";
    return "操作失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。";
}

function clearPasswordInputs() {
    const list = [
        ...document.querySelectorAll('input[type="password"]'),
        ...(document.querySelectorAll?.('input[data-password-field]') || [])
    ];
    const seen = new Set();
    for (const input of list) {
        if (!input || seen.has(input)) continue;
        seen.add(input);
        input.value = "";
        if (input.type === 'text') {
            input.type = 'password';
            const btn = document.querySelector?.(`.password-toggle-btn[data-target="${input.id}"]`);
            if (btn) {
                btn.setAttribute?.('aria-label', '显示密码');
                btn.setAttribute?.('title', '显示密码');
                btn.classList?.remove?.('revealed');
                const icon = btn.querySelector?.('.password-toggle-icon');
                if (icon) icon.textContent = '👁️';
            }
        }
    }
}

function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll?.('.password-toggle-btn') || [];
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset?.target || btn.getAttribute?.('data-target');
            const input = targetId ? $(targetId) : null;
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.setAttribute?.('aria-label', isPassword ? '隐藏密码' : '显示密码');
            btn.setAttribute?.('title', isPassword ? '隐藏密码' : '显示密码');
            if (isPassword) {
                btn.classList?.add?.('revealed');
            } else {
                btn.classList?.remove?.('revealed');
            }
            const icon = btn.querySelector?.('.password-toggle-icon');
            if (icon) icon.textContent = isPassword ? '🙈' : '👁️';
            input.focus?.({ preventScroll: true });
        });
    });
}

$("go-register").addEventListener("click", () => {
    $("register-status").textContent = "";
    clearPasswordInputs();
    showOnly("register");
    $("register-email").focus();
});
$("back-to-login").addEventListener("click", () => {
    $("login-status").textContent = "";
    clearPasswordInputs();
    showOnly("login");
    $("login-email").focus();
});
$("go-forgot").addEventListener("click", () => {
    $("forgot-status").textContent = "";
    clearPasswordInputs();
    showOnly("forgot");
    $("forgot-email").focus();
});
$("forgot-back").addEventListener("click", () => {
    $("login-status").textContent = "";
    clearPasswordInputs();
    showOnly("login");
});

$("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("login-button");
    button.disabled = true;
    $("login-status").textContent = "";
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: $("login-email").value.trim(),
            password: $("login-password").value
        });
        if (error) throw error;
        if (!data.session) throw new Error("Email not confirmed");
        goNext();
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("login-status").textContent = authErrorMessage(error);
    } finally {
        clearPasswordInputs();
        button.disabled = false;
    }
});

$("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("register-button");
    button.disabled = true;
    $("register-status").textContent = "";
    const email = $("register-email").value.trim();
    const password = $("register-password").value;
    try {
        const passwordIssue = validateNewPassword(password);
        if (passwordIssue) throw new Error(passwordIssue);
        if (password !== $("register-password-confirm").value) {
            throw new Error("两次输入的密码不一致。");
        }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/login.html` }
        });
        if (error) throw error;
        if (data.session) {
            goNext();
            return;
        }
        // 没直接给登录态：一般是开了邮箱确认，等用户点邮件里的链接。
        pendingConfirmEmail = email;
        $("resend-confirm").hidden = false;
        $("register-status").textContent =
            "注册成功。请去邮箱里点确认链接，再回来登录。如果没收到，可以点下面的「重新发送确认邮件」。";
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("register-status").textContent =
            String(error.message || "").includes("两次输入")
                ? "两次输入的密码不一致，请重新输入。"
                : authErrorMessage(error);
    } finally {
        clearPasswordInputs();
        button.disabled = false;
    }
});

$("resend-confirm").addEventListener("click", async () => {
    if (!pendingConfirmEmail || resendBusy || resendCooldownTimer) return;
    const button = $("resend-confirm");
    resendBusy = true;
    button.disabled = true;
    setButtonText(button, '正在重新发送…');
    $("register-status").textContent = "正在重新发送确认邮件…";
    try {
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: pendingConfirmEmail,
            options: { emailRedirectTo: `${window.location.origin}/login.html` }
        });
        if (error) throw error;
        $("register-status").textContent = "确认邮件已重新发送，请去邮箱里查看。";
        startResendCooldown(60);
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("register-status").textContent = authErrorMessage(error);
        stopResendCooldown(true);
    } finally {
        resendBusy = false;
        if (!resendCooldownTimer) {
            button.disabled = false;
            setButtonText(button, '重新发送确认邮件');
        }
    }
});

$("forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (forgotBusy || forgotCooldownTimer) return;
    const button = $("forgot-button");
    const email = $("forgot-email").value.trim().toLowerCase();
    if (!email) return;

    forgotBusy = true;
    button.disabled = true;
    setButtonText(button, '正在请求发送…');
    $("forgot-status").textContent = "";
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            { redirectTo: `${window.location.origin}/login.html` }
        );
        if (error) throw error;
        $("forgot-status").textContent =
            "如果这个邮箱注册过，重置密码的邮件已经发出，请去邮箱里点链接回来设置新密码。";
        startForgotCooldown(60, null, email);
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("forgot-status").textContent = authErrorMessage(error);
        stopForgotCooldown(true);
    } finally {
        clearPasswordInputs();
        forgotBusy = false;
        if (!forgotCooldownTimer) {
            button.disabled = false;
            setButtonText(button, '发送重置邮件');
        }
    }
});

$("recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("recovery-button");
    button.disabled = true;
    $("recovery-status").textContent = "";
    const password = $("recovery-password").value;
    try {
        const passwordIssue = validateNewPassword(password);
        if (passwordIssue) throw new Error(passwordIssue);
        if (password !== $("recovery-password-confirm").value) {
            throw new Error("两次输入的密码不一致。");
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        goNext();
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("recovery-status").textContent =
            String(error.message || "").includes("两次输入")
                ? "两次输入的密码不一致，请重新输入。"
                : authErrorMessage(error);
    } finally {
        clearPasswordInputs();
        button.disabled = false;
    }
});

async function init() {
    initPasswordToggles();
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            stopForgotCooldown(false);
            stopResendCooldown(false);
        });
    }
    const forgotEmailInput = $("forgot-email");
    if (forgotEmailInput) {
        forgotEmailInput.addEventListener("input", restoreForgotCooldown);
    }
    restoreForgotCooldown();
    restoreResendCooldown();

    const isRecovery = /(^|[#&])type=recovery([&]|$)/.test(window.location.hash);
    if (!isConfigured()) {
        $("login-status").textContent = getConfigError();
        showOnly("login");
        return;
    }
    try {
        supabase = await getSupabase();
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
        $("login-status").textContent = "无法加载 Supabase 的 JS 库，请检查网络或 CDN 是否可用，刷新后再试。";
        showOnly("login");
        return;
    }
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isRecovery) {
            showOnly("recovery");
            $("recovery-password").focus();
            return;
        }
        if (data.session) {
            goNext();
            return;
        }
    } catch (error) {
        console.warn("认证请求未完成，请查看页面提示。");
    }
    showOnly("login");
}

init();
