# 留言板权限修复（2026-11-01）

状态：店主已反馈线上 SQL 执行成功，并验证提交与审核流程。仅修改仓库不会改变数据库权限；以下供其他环境部署及复查使用。

1. 在 Supabase 项目的 SQL Editor 新建查询，复制 `guestbook-security-fix.sql` 全文执行。脚本不删除已有留言，事务失败会回滚，可重复执行。
2. 执行 `guestbook-security-check.sql`。成功应无异常，NOTICE 为 PASS；它只检查权限，不读取留言内容。该检查不能替代下面的真实账号流程测试。
3. 访客登录后正常提交一条测试留言，应提示待审核，首页暂不显示。
4. 店主在后台把该条 approved 改为 true，刷新首页应显示；后台仍能看邮箱。
5. 如有报错，提供错误原文即可，不提供密码、口令或密钥。

原问题：INSERT 策略未限制 approved；不在前端 select 邮箱并不等于数据库禁止读取。
修复：撤销表级及旧列级权限；只允许读取公开列和提交 user_id/name/email/message；RLS 强制本人且 approved=false，并用限制性策略防止额外宽松策略绕过。approved 保留读取权限以兼容现有前端筛选。前端无需修改。

当前只处理该表权限；自定义视图、RPC、角色继承等如果另有配置，需要另行审查。未改变网站登录、备忘录、商店或部署设置。


2026-11-01 店主反馈：权限修复 SQL 执行成功，访客提交 → 待审核不显示 → 店主审核后显示流程符合预期。此为店主实测反馈，agent 未登录后台独立核验。修复脚本随本次发布纳入仓库。

## 留言点赞（2026-11-13，待店主执行）

前端与这次的提交一起上线，但**数据库没跑这段迁移时页面不会报错**：`guestbook_like_state()` 调不通就整排收起点赞按钮，留言照常显示。所以这一步只能由店主在 Supabase Dashboard 的 SQL Editor 里做：

1. 新建查询，粘贴 `guestbook-likes.sql` 全文执行。脚本幂等，可重复运行，不动 `guestbook_messages` 里的任何一行。
2. 再执行 `guestbook-security-check.sql`。它新增了点赞体检：表存在但 RLS 没开、匿名角色拿到任何表权限、`anon` 能执行 `guestbook_set_like`、两个函数没锁 `search_path`，都会 `FAIL`；没跑第 1 步时是 `SKIP` 提示，不算失败。
3. 用一个访客账号登录，给已公开的留言点一下：数字应立刻 +1 并变成实心 ♥；刷新后仍是从服务端读回的真实计数。再点一次取消。

设计边界（本地 PGlite 已逐条证过，见 `tests/permissions.test.mjs`）：

- `guestbook_likes` 不给任何角色直接读写权限，一条 RLS 策略都不建。所有读写只能走两个 `security definer` 函数，`set search_path = ''` 钉死，防搜索路径劫持。
- 未通过审核的留言与不存在的 id 返回同一句提示（`这条留言暂时不接受点赞`），不给外部用来探测后台留言是否存在。
- 点赞只能本人撤销：`set_like(false)` 只删 `user_id = auth.uid()` 那一行，别人的票动不了。
- 重复点赞同一个 `(message_id, user_id)` 主键天然幂等；删除留言按外键 `on delete cascade` 连带清掉票，不留孤儿计数。

