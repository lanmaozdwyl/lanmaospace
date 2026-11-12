// Lanmao Space 共享 Supabase 客户端初始化模块。
// 全站只创建一次客户端实例，避免重复配置校验和多次 import。
// SDK 改成站点内自托管：lib/vendor 那份打包文件就是运行时唯一副本，CSP 的 script-src
// 因此能从 'self' https://cdn.jsdelivr.net 收紧到只剩 'self'。
// 版本、来源、构建命令和哈希记在 lib/vendor/vendor.json，核对跑 scripts/vendor-supabase-sdk.mjs。

const SUPABASE_SDK_URL = "/lib/vendor/supabase-js-2.39.0.mjs";

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
