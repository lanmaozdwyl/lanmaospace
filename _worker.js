// Supabase 反向代理（Cloudflare Pages 高级模式 _worker.js）
// 路由规则：
//   /sbproxy/rest/v1/*   ->  转发表格数据接口，权限仍由 Supabase RLS 决定
//   /sbproxy/storage/v1/*->  转发存储接口（头像等）
//   其余 /sbproxy/*      ->  一律 403，包括 /auth/v1 和 /realtime/v1
//   非 /sbproxy 路径     ->  正常返回网站静态文件
//
// 为什么不再原样透传：代理只校验"有没有带 apikey"，而 anon key 本来就印在前端里，
// 任何人都能拿来通过。放行 /auth/v1 等于用本站域名开放了密码撞库（token）、
// 邮箱验证码爆破（verify）和找回密码轰炸（recover）；更要命的是 Cloudflare 会替
// 请求方掩掉源 IP，Supabase 侧看到的全是节点地址，自带的 IP 频率限制直接失效。
// 因此这里改成按路径白名单转发，把鉴权类接口彻底挡在代理之外。
//
// Origin 校验只用来拦住浏览器发起的跨站滥用（脚本会自动带 Origin），
// curl 之类可以自己填头，所以它不是鉴权手段，真正的边界是白名单路径 + RLS。
// 换绑自定义域名时，在 ALLOWED_ORIGINS 里补一条即可。
const UPSTREAM = "https://kyhhzaftsyakibdisiqj.supabase.co";
const ALLOWED_PATH_ROOTS = ["/rest/v1", "/storage/v1"];
const ALLOWED_ORIGINS = ["https://lanmaospace.pages.dev"];
// 转发前删掉的请求头：Cookie 会把访问者的站内凭据捎到上游，
// Host 与 CF-* 是本站节点的连接信息，对上游没有意义。
const STRIPPED_HEADERS = [
    "cookie", "host", "origin", "referer",
    "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor",
    "x-forwarded-for", "x-forwarded-proto",
];

function isAllowedPath(path) {
    return ALLOWED_PATH_ROOTS.some(root => path === root || path.startsWith(`${root}/`));
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== "/sbproxy" && !url.pathname.startsWith("/sbproxy/")) {
            return env.ASSETS.fetch(request);
        }

        const path = url.pathname.slice("/sbproxy".length);
        if (!isAllowedPath(path)) {
            return new Response("forbidden path", { status: 403 });
        }

        const origin = request.headers.get("origin");
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            return new Response("forbidden origin", { status: 403 });
        }

        if (!request.headers.get("apikey") && !request.headers.get("authorization")) {
            return new Response("missing api key", { status: 403 });
        }

        const headers = new Headers(request.headers);
        for (const name of STRIPPED_HEADERS) headers.delete(name);

        const withBody = request.method !== "GET" && request.method !== "HEAD";
        const upstream = await fetch(new Request(UPSTREAM + path + url.search, {
            method: request.method,
            headers,
            body: withBody ? request.body : undefined,
            redirect: "manual",
        }));
        // _headers 只作用于静态资源，代理响应是这个 worker 亲手造的对象，谁也管不到它。
        // 这里不沿用上游的默认值：万一哪天响应带上了可缓存的 Cache-Control，
        // Cloudflare 就会把某个用户的行数据缓在边缘节点，回给后面所有访问的人。
        const forwarded = new Headers(upstream.headers);
        forwarded.set("cache-control", "no-store");
        // 取回来的 body 已经解压过了，再挂着头上的 content-encoding/length 就是把
        // 长度和编码说谎给下一跳。去掉之后按 chunked 走，谁也不会拿到截断的响应。
        forwarded.delete("content-encoding");
        forwarded.delete("content-length");
        return new Response(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: forwarded,
        });
    },
};
