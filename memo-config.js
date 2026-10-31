// Lanmao Space 备忘录配置。
// 这里只能放 Supabase 的 Project URL 和 publishable / anon key。
// anon key 本来就是公开给前端用的，真正起保护作用的是数据库的行级权限（RLS）。
// 绝对不要把 service_role key、secret key 或任何后端密钥写在这里、写进仓库或发在聊天里。
window.LANMAO_MEMO_CONFIG = {
  url: "https://kyhhzaftsyakibdisiqj.supabase.co",
  anonKey: "sb_publishable_yWzUDZejVHSFjogwO-qD0g_grI0eZ4p"
};
