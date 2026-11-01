// Lanmao Space 全站登录守卫：首页、商店、备忘录、工具站共用。
// 登录页地址用网站根目录的绝对路径，这样子目录页面（tools/）也不会跳错。
// 作用：没登录就跳到 login.html，登录成功后跳回原来想打开的页面。
// 这是静态站的前端守卫，只能拦住正常浏览：懂行的人关掉 JS 或直接请求
// 文件还是能看到页面本身。真正敏感的备忘录内容不受影响，因为它是加密
// 后才同步的，解密还要备忘录口令。CDN 加载失败时不锁死页面，只记日志。
// 登录页本身不加载这个文件，避免跳转死循环。

import { getSupabase, isConfigured } from './lib/supabase-client.js';

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
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
            window.location.replace(loginUrl());
            return;
        }
    } catch (error) {
        console.error(error);
        return;
    }

    // 已登录：在别的标签页退出时，本页也回到登录页。
    supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") window.location.replace("/login.html");
    });

    // 导航里的退出登录按钮（首页、商店共用 data-signout）。
    document.addEventListener("click", async (event) => {
        const trigger = event.target.closest("[data-signout]");
        if (!trigger) return;
        event.preventDefault();
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error(error);
        }
        window.location.replace("/login.html");
    });
}

guard();
