// Lanmao Space 全站登录守卫：首页、商店、备忘录、工具站共用。
// 登录页地址用网站根目录的绝对路径，这样子目录页面（tools/）也不会跳错。
// 作用：没登录就跳到 login.html，登录成功后跳回原来想打开的页面。
// 这是静态站的前端守卫，只能拦住正常浏览：懂行的人关掉 JS 或直接请求
// 文件还是能看到页面本身。真正敏感的备忘录内容不受影响，因为它是加密
// 后才同步的，解密还要备忘录口令。CDN 加载失败时不锁死页面，只记日志。
// 登录页本身不加载这个文件，避免跳转死循环。

import { getSupabase, isConfigured } from './lib/supabase-client.js';
import { avatarDisplay, avatarPublicUrl, fetchProfile } from './lib/avatar.mjs';
import {bindSignOut} from './lib/signout.mjs';

function loginUrl() {
    const next = encodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash
    );
    return `/login.html?next=${next}`;
}

async function guard() {
    if (!isConfigured()) return;
    let supabase;
    try {
        supabase = await getSupabase();
    } catch (error) {
        console.error(error);
        return;
    }
    let sessionUserId = null;
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
            window.location.replace(loginUrl());
            return;
        }
        sessionUserId = data.session.user.id;
    } catch (error) {
        console.error(error);
        return;
    }

    // 已登录：在别的标签页退出时，本页也回到登录页。
    supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") window.location.replace("/login.html");
    });

    // 已登录：把本人头像填进导航占位（data-header-avatar）；没头像或表还没建好时保持默认 👤。
    fillHeaderAvatar(supabase, sessionUserId).catch((error) => console.error(error));

    bindSignOut(supabase,document,{
        navigate:path=>window.location.replace(path),
        onFailure:text=>window.alert(text),
    });

}

async function fillHeaderAvatar(client, userId) {
    const slot = document.querySelector("[data-header-avatar]");
    if (!slot) return;
    let profile = null;
    try {
        profile = await fetchProfile(client, userId);
    } catch {
        return;
    }
    const display = avatarDisplay(profile);
    if (!display) return;
    slot.replaceChildren();
    if (display.type === "image") {
        const img = document.createElement("img");
        img.src = avatarPublicUrl(client, display.path);
        img.alt = "";
        slot.append(img);
        return;
    }
    slot.style.background = display.color;
    const emoji = document.createElement("span");
    emoji.textContent = display.emoji;
    slot.append(emoji);
}

guard();
