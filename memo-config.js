// Lanmao Space 全站登录配置：登录页、全站守卫、备忘录共用同一个 Supabase 项目。
// 这里只能放 Supabase 的 Project URL 和 publishable / anon key。
// anon key 本来就是公开给前端用的，真正起保护作用的是数据库的行级权限（RLS）。
// 绝对不要把 service_role key、secret key 或任何后端密钥写在这里、写进仓库或发在聊天里。
window.LANMAO_MEMO_CONFIG = {
  url: "https://kyhhzaftsyakibdisiqj.supabase.co",
  anonKey: "sb_publishable_yWzUDZejVHSFjogwO-qD0g_grI0eZ4p",
  ownerEmail: "2978427016@qq.com", // 店主邮箱：备忘录只认这个账号，访客账号打不开。推送前必须填好。
};
