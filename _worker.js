// Supabase 反向代理（Cloudflare Pages 高级模式 _worker.js）
// 路由规则：
//   /sbproxy/*  ->  转发到 Supabase（路径原样透传，如 /sbproxy/rest/v1/xxx）
//   其余路径    ->  正常返回网站静态文件
// 安全：必须携带 apikey 或 Authorization 请求头；数据权限仍由 Supabase RLS 控制。
const UPSTREAM = "https://kyhhzaftsyakibdisiqj.supabase.co";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/sbproxy" || url.pathname.startsWith("/sbproxy/")) {
      if (!request.headers.get("apikey") && !request.headers.get("authorization")) {
        return new Response("missing api key", { status: 403 });
      }
      const path = url.pathname.slice("/sbproxy".length) || "/";
      return fetch(new Request(UPSTREAM + path + url.search, request));
    }
    return env.ASSETS.fetch(request);
  },
};
