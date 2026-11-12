// Supabase 反向代理（Netlify Functions v2）
// 访问方式：https://lanmaospace.netlify.app/sbproxy/rest/v1/...
// 作用与安全说明同 functions/sbproxy.js（Cloudflare Pages 版本）。
const UPSTREAM = "https://kyhhzaftsyakibdisiqj.supabase.co";

export default async (req) => {
  if (!req.headers.get("apikey") && !req.headers.get("authorization")) {
    return new Response("missing api key", { status: 403 });
  }
  const url = new URL(req.url);
  const path =
    url.pathname.replace(/^\/(sbproxy|\.netlify\/functions\/sbproxy)/, "") || "/";
  const upstream = UPSTREAM + path + url.search;
  return fetch(new Request(upstream, req));
};

export const config = { path: "/sbproxy/*" };
