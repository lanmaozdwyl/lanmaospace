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

function showOnly(name) {
    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
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
    const allowed = ["/", "/index", "/index.html", "/store", "/store.html", "/memo", "/memo.html", "/tools", "/tools/", "/tools/index.html", "/profile", "/profile.html", "/faq", "/faq.html"];
    if (!allowed.includes(parsed.pathname)) return "index.html";
    return parsed.pathname + parsed.search + parsed.hash;
}

function goNext() {
    window.location.replace(safeNext());
}

function authErrorMessage(error) {
    const message = String(error && error.message ? error.message : "");
    if (message.includes("Invalid login credentials")) return "邮箱或密码不对，请再试一次。";
    if (message.includes("Email not confirmed")) return "这个邮箱还没有确认，请先点确认邮件里的链接，再回来登录。";
    if (message.includes("User already registered")) return "这个邮箱已经注册过了，请直接登录。";
    if (message.includes("Signups not allowed")) return "注册暂时没有打开，请联系店主在 Supabase 后台打开注册后再试。";
    if (message.includes("Password should be at least")) return "密码太短了，请用至少 8 位。";
    if (message.includes("Unable to validate email address")) return "这个邮箱地址看起来不对，请检查后再试。";
    if (message.includes("For security purposes")) return "尝试太频繁了，请稍等一会儿再试。";
    return "操作失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。";
}

$("go-register").addEventListener("click", () => {
    $("register-status").textContent = "";
    showOnly("register");
    $("register-email").focus();
});
$("back-to-login").addEventListener("click", () => {
    $("login-status").textContent = "";
    showOnly("login");
    $("login-email").focus();
});
$("go-forgot").addEventListener("click", () => {
    $("forgot-status").textContent = "";
    showOnly("forgot");
    $("forgot-email").focus();
});
$("forgot-back").addEventListener("click", () => {
    $("login-status").textContent = "";
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
        console.error(error);
        $("login-status").textContent = authErrorMessage(error);
    } finally {
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
        if (password.length < 8) throw new Error("Password should be at least 8 characters");
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
        console.error(error);
        $("register-status").textContent =
            String(error.message || "").includes("两次输入")
                ? "两次输入的密码不一致，请重新输入。"
                : authErrorMessage(error);
    } finally {
        button.disabled = false;
    }
});

$("resend-confirm").addEventListener("click", async () => {
    if (!pendingConfirmEmail) return;
    $("register-status").textContent = "正在重新发送…";
    try {
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: pendingConfirmEmail,
            options: { emailRedirectTo: `${window.location.origin}/login.html` }
        });
        if (error) throw error;
        $("register-status").textContent = "确认邮件已重新发送，请去邮箱里查看。";
    } catch (error) {
        console.error(error);
        $("register-status").textContent = authErrorMessage(error);
    }
});

$("forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("forgot-button");
    button.disabled = true;
    $("forgot-status").textContent = "";
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(
            $("forgot-email").value.trim(),
            { redirectTo: `${window.location.origin}/login.html` }
        );
        if (error) throw error;
        $("forgot-status").textContent =
            "如果这个邮箱注册过，重置密码的邮件已经发出，请去邮箱里点链接回来设置新密码。";
    } catch (error) {
        console.error(error);
        $("forgot-status").textContent = authErrorMessage(error);
    } finally {
        button.disabled = false;
    }
});

$("recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("recovery-button");
    button.disabled = true;
    $("recovery-status").textContent = "";
    const password = $("recovery-password").value;
    try {
        if (password.length < 8) throw new Error("Password should be at least 8 characters");
        if (password !== $("recovery-password-confirm").value) {
            throw new Error("两次输入的密码不一致。");
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        goNext();
    } catch (error) {
        console.error(error);
        $("recovery-status").textContent =
            String(error.message || "").includes("两次输入")
                ? "两次输入的密码不一致，请重新输入。"
                : authErrorMessage(error);
    } finally {
        button.disabled = false;
    }
});

async function init() {
    const isRecovery = /(^|[#&])type=recovery([&]|$)/.test(window.location.hash);
    if (!isConfigured()) {
        $("login-status").textContent = getConfigError();
        showOnly("login");
        return;
    }
    try {
        supabase = await getSupabase();
    } catch (error) {
        console.error(error);
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
        console.error(error);
    }
    showOnly("login");
}

init();
