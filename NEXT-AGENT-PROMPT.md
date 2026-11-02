你现在接手维护我的个人网站 Lanmao Space。请用中文，先核对仓库现状，再按优先级继续完成任务，不要重复开发已完成的功能。

一、先读与核验
1. 先读 README.md、HANDOFF.md 顶部“当前权威状态”、TASKS.md、MEMO-GUIDE.md、STORE-GUIDE.md，以及实际存在的 AGENTS.md。
2. 实际仓库 D:\ANTIgravity-dataspace\lanmaospace；当前 Codex 工作目录 C:\Users\29784\OneDrive\文档\ChatGPT\lanmaospace 是辅助工作区，不要误当仓库。其他电脑先 clone https://github.com/lanmaozdwyl/lanmaospace 。
3. 先 git fetch origin，再检查本地状态和 origin/main。2026-11-02 功能基线为 2515b416a7428680c2220bd2d2eb9d74485b8927，后续文档提交或其他电脑更新以远程实际状态为准。有差异先说明，不覆盖、reset 或 force-push。必要时用 git --work-tree=D:/ANTIgravity-dataspace/lanmaospace。

二、当前实际状态
- 正式站 https://lanmaospace.pages.dev/，Cloudflare Pages 免费项目 lanmaospace，关联 GitHub main。Framework None，构建命令 node scripts/build.mjs，发布目录 dist。
- 老 Netlify https://lanmaospace.netlify.app/ 因部署额度耗尽停留旧版；不是现在正式站。不要操作另一个 serene-semolina-11bcfc 项目。
- 原生 HTML/CSS/JS；静态运行不需要框架。build 先检查语法与测试，再白名单打包根目录运行文件和 lib/tools/images，新增运行文件要检查是否需加入白名单。dist 存在时构建会拒绝，不能无核对递归删目录。
- 商店由 products.json 提供数据，接单 QQ 3126477562，人工接单/发货，无在线支付。可选字段 availability、priceUpdatedAt、deliveryNote 已实现但缺真实资料不填。
- Supabase 登录与数据库继续保留。备忘录浏览器内加密，支持附件、备份与副本恢复、10 分钟空闲锁定/加密草稿、标签置顶回收站和并发冲突保护。
- guestbook-admin.js 为店主提供首页审核/撤回公开。数据库 RPC 在 supabase/guestbook-owner-review.sql。店主已反馈执行此 SQL 和 memo-owner-security.sql，新域名 Auth Site URL/Redirect URLs 也反馈配置完成；真实邮件、审核、附件及备份流程仍未完整实测，不能写成已验证。
- 2026-11-02 晚：线上验收脚本已扩展覆盖商店/工具站，商店加载失败状态已修复（提交 79a8c06，已上线核验 PASS）；功能测试 34 项，真实浏览器回归仍未做。

三、铁律
- 常规更新已获授权：检查通过可直接推 main 并上线，不要每次再问确认。价格、接单方式、付费购买、访问范围扩大、删除真实数据等仍需具体授权。
- 保留黑白分区、柔和渐变和动效风格，兼顾手机/键盘/prefers-reduced-motion，内容不能依赖动画完成才可读。
- 不索要、打印或提交密码、备忘录口令、验证码、service_role/secret key、用户订单、备忘录明文。anon/publishable key 和店主配置只留 memo-config.js，不复制到聊天、文档或日志。
- ownerUid 已配置；备忘录 SQL/RPC 也校验店主身份。前端登录守卫是软门禁，不能称为服务端鉴权。不要关闭 RLS 或邮箱确认来绕过问题。
- 不编造统计数字、友情链接、库存、核价日期、交付时效。读书笔记子站暂缓，不擅自公开 Notion 全文。
- 不操作真实留言/备忘录作破坏性测试；优先隔离模拟环境，实际流程由用户指定测试数据。私人备份由用户解锁并保存，不索要口令。

四、同步与发布流程
1. fetch → 审查远程变化及本地修改 → 仅改相关文件。
2. node scripts/check.mjs / npm test 当前 34 项（22 备忘录、3 审核界面、4 商品校验、5 商店加载失败/搜索/重试/详情，Node 模拟环境）。SQL 改动另跑 node tests/permissions.test.mjs 当前 38 项，需 PGlite 或 PGLITE_MODULE，不在无依赖云端构建里运行。
3. 本地 HTTP 服务验证返回 200、关键标记，并做改动相应的真实浏览器测试。新增模块、图片等核对 dist 打包。适当添加故障路径测试，不把模拟测试称为线上实测。
4. 推送只包含核实的变化。优先使用可用 GitHub 连接器；当前环境可 create_tree(base_tree)、create_commit(parent)、update_ref(expected_sha, force=false) 原子更新。失败先查远程再决定，不盲目重试。只有 provider 确认成功才记录提交。
5. 同步日志是辅助工作区 website-update/release-sync.jsonl，只追加。旧跨主机同步文件本机不存在，不伪造历史。
6. 推送后等待 Cloudflare 构建并核验 https://lanmaospace.pages.dev/，运行 node scripts/verify-live.mjs；该脚本覆盖备忘录、商店、工具站、首页与登录页标记、商品目录结构与商品图片。HTML 可能被平台改写，应结合关键标记，脚本可以规范换行后比哈希。不能将推送成功当作已上线。
7. 更新 HANDOFF.md 当前状态和 TASKS.md。总结已完成、测试证据、尚待真实验证项。

五、接下来怎么做
先按 TASKS.md 的 P0–P3 执行。P0 涉及用户邮件/密码/私人数据时说明所需用户操作，同时继续独立工作；不要无限等待。线上验收脚本扩展与商品加载失败、重试、搜索的 Node 模拟测试已完成（提交 79a8c06）；下一项可独立推进的是 P1 真实浏览器回归，然后检查手机/键盘与图片加载性能。缺资料的 P2 保留待办，不凭猜测填内容。不要另建账号、购买套餐或迁移平台。
