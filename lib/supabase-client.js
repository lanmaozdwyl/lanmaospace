// Lanmao Space 共享 Supabase 客户端初始化模块。
// 全站只创建一次客户端实例，避免重复配置校验和多次 import 同一个 CDN 库。
// SDK 版本已锁定，不会自动拉取 2.x 最新版，防止供应链风险。

const SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm";

let clientPromise = null;

function validateConfig(config) {
    const url = config && typeof config.url === "string" ? config.url : "";
    const anonKey = config && typeof config.anonKey === "string" ? config.anonKey : "";
    return (
        url.startsWith("https://") &&
        url.includes(".supabase.co") &&
        anonKey.length >= 20 &&
        !anonKey.startsWith("YOUR-")
    );
}

export function isConfigured() {
    return validateConfig(window.LANMAO_MEMO_CONFIG);
}

export function getConfigError() {
    return "登录还没有接好：请店主先在 Supabase 后台完成配置，再打开这个页面。";
}

export async function getSupabase() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
        const config = window.LANMAO_MEMO_CONFIG;
        if (!validateConfig(config)) {
            throw new Error(getConfigError());
        }
        const { createClient } = await import(SUPABASE_SDK_URL);
        return createClient(config.url, config.anonKey);
    })();
    return clientPromise;
}

export function resetClient() {
    clientPromise = null;
}
