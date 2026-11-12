// Supabase 反向代理（Cloudflare Pages Functions）
// 访问方式：https://lanmaospace.pages.dev/sbproxy/rest/v1/...
// 作用：为国内访客和站点维护中转 Supabase 请求，路径与请求头原样透传。
// 安全：必须携带 apikey 或 Authorization 请求头（Supabase 客户端本来就会带），
//       数据权限仍由 Supabase 的 RLS 规则控制，代理不做任何放权。
const UPSTREAM = "https://kyhhzaftsyakibdisiqj.supabase.co";

export async function onRequest(context) {
  const request = context.request;
  if (!request.headers.get("apikey") && !request.headers.get("authorization")) {
    return new Response("missing api key", { status: 403 });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/sbproxy/, "") || "/";
  const upstream = UPSTREAM + path + url.search;
  return fetch(new Request(upstream, request));
}
