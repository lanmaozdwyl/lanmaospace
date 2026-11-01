# Lanmao Space：开发交接

最后整理：2026-10-31。以下是该日期的已验证状态，修改前请重新检查 Git 与部署状态。

## 项目与发布

- GitHub：https://github.com/lanmaozdwyl/lanmaospace
- 正式站点：https://lanmaospace.netlify.app/
- 商店：https://lanmaospace.netlify.app/store.html
- 主分支：`main`。Netlify 项目 `lanmaospace` 已关联此仓库，推送 main 会自动发布。
- Netlify 项目 ID：`81cff751-a2e7-4c10-9a55-5da8bcbf5a21`。
- 正式站点 Public；Deploy Preview Private。不要因预览需要改变访问权限。
- 账号内还有 `serene-semolina-11bcfc`，也连接此仓库，但不是上述正式网址。不要误操作、重命名或删除该项目。
- Netlify 发布目录 `.`，无构建命令、无依赖安装要求。
- 原电脑目录：`D:\ANTIgravity-dataspace\lanmaospace`。其他电脑应以实际克隆目录为准。

## 技术与文件

原生 HTML / CSS / JavaScript 静态站，没有 React、npm 构建或数据库。

| 文件 | 用途 |
| --- | --- |
| index.html | 首页内容、导航、书单、音乐影视、友链、工具箱、留言区 |
| style.css | 全站基础样式及首页响应式布局 |
| script.js | 首页菜单、滚动显示、计数器、书单筛选、影视切换、临时留言 |
| store.html | 商店结构、搜索分类、详情弹窗、咨询说明 |
| store.css | 商店布局与卡片样式 |
| store.js | catalog 商品数据、价格、分类搜索、详情与 QQ 联系链接 |
| motion.css / motion.js | 两页共用的动效：入场、进度线、卡片柔光和轻微倾斜、弹窗动画 |
| memo.html / memo.css / memo.js | 私人备忘录页：Supabase 登录 + 浏览器内加密同步，仅店主账号可解锁，在导航里有入口，`noindex` |
| memo-config.js | 全站登录配置：只放 Supabase Project URL、anon / publishable key 和店主邮箱，绝不放 service_role key |
| login.html / login.js / auth-guard.js / auth.css | 全站登录页（登录、注册、忘记/重置密码）和首页、商店、备忘录共用的登录守卫 |
| guestbook.js | 留言板前端：只读审核通过的留言，提交后等店主审核，邮箱不公开显示 |
| supabase/memos.sql | 备忘录建表与行级权限 SQL，在 Supabase SQL Editor 里运行一次 |
| supabase/guestbook.sql | 留言板建表与行级权限 SQL，在 Supabase SQL Editor 里运行一次 |
| supabase/memo-files.sql | 附件建表与私有存储桶 SQL，在 Supabase SQL Editor 里运行一次（先运行 memos.sql） |

## 备忘录（Supabase + 加密，2026-10-31 已推送到 main，待店主登录验证）

- 方案：用户已选 Supabase + 客户端加密（跨设备同步）。2026-10-31 已收到 Project URL 和 publishable key 并填进 `memo-config.js`（key 只存该文件，不记在交接文档或记忆里），匿名请求检查确认 `memos` / `memo_vault` 两张表已存在且受 RLS 保护（未登录返回空列表）。代码已推送到 main，Netlify 自动部署后由店主亲自登录并设置备忘录口令测试；登录账号能否登录，推送前未用密码验证。
- 流程：`memo.html` 登录（邮箱 + 登录密码，Supabase Auth）→ 输入备忘录口令 → 浏览器内用 PBKDF2（21 万次，SHA-256）派生 AES-GCM 密钥 → 内容加密成密文后存 Supabase，解密只在内存里进行。登录密码和备忘录口令是两个不同的口令；备忘录口令忘了无法恢复。
- 表：`memo_vault`（每用户一行：salt、加密校验串）和 `memos`（密文、IV），建表 SQL 见 `supabase/memos.sql`，两表都开 RLS 且只允许本人读写。不要关 RLS，不要加所有人可读/可写的策略。
- 配置分工：建 Supabase 项目、运行 SQL、关闭公开注册、创建登录账号、复制 Project URL 和 anon / publishable key，必须由店主在 Supabase 后台操作；不要在聊天里要 service_role key、secret key、登录密码或备忘录口令。anon key 会出现在前端代码里，靠 RLS 保护，这是设计如此。
- 限制：免费 Supabase 项目闲置一周可能暂停，需在后台恢复；备忘录页不做搜索引擎收录；不要把账号密码、验证码等极敏感信息当作普通备忘录存放，也不要把备忘录明文写进仓库或前端。

## 全站登录（2026-10-31 已推送到 main，待店主和访客账号实测）

- 决定：2026-10-31 店主选了“整个网站都要登录才能看，包括商店”且“访客可以自己注册邮箱账号再登录”。首页、商店、备忘录都由 `auth-guard.js` 守卫，未登录跳到 `login.html`，登录成功跳回原页面；导航里加了备忘录入口和退出登录。
- 登录页：`login.html` / `login.js` 提供登录、注册、忘记密码、重置密码（点邮件链接回来设新密码）。注册成功后若开了邮箱确认，需先点确认邮件再登录，页面上有重新发送确认邮件的按钮。`memo-config.js` 里新增 `ownerEmail`（店主邮箱），备忘录只认这个邮箱，访客账号登录后在备忘录页只会看到“仅店主可用”，不能新建备忘录；`ownerEmail` 为空时谁也打不开。
- 重要限制：这是静态站的前端守卫，只能拦正常浏览，关掉 JS 或直接请求文件仍能看到页面本身；备忘录内容本身加密，访客拿不到店主的备忘录明文。数据库 RLS 目前仍是“每个已登录用户只能读写自己名下的行”，访客不能读店主的行；如需把备忘录表收紧到只有店主 UID 可读写，需店主在 Supabase 后台提供店主账号的 UID 后再改 SQL，不要只靠前端。
- 店主已在 Supabase 后台做的事（2026-10-31 店主自报已完成，未独立验证）：在 Authentication → Sign In / Providers 里打开“Allow new users to sign up”；确认 Email 提供商仍启用；把 Site URL 设为 `https://lanmaospace.netlify.app/`，并把 `https://lanmaospace.netlify.app/login.html` 加进 Redirect URLs；提供店主邮箱填进 `ownerEmail`。“Confirm email”的开关状态未单独确认，登录页代码同时兼容开/关两种情况。不要发登录密码、备忘录口令或 service_role key。

## 留言板（2026-11-01 已推送到 main，待店主实测提交与审核）

- 决定：2026-11-01 店主选了留言板接 Supabase、留言需审核后才显示，并确认已运行 guestbook.sql（匿名请求检查确认 `guestbook_messages` 表已存在）。
- 流程：`guestbook.js` 只读 `approved = true` 的留言，提交时写入 `guestbook_messages`（`approved` 默认 false）；店主在 Supabase 后台 Database → Tables → guestbook_messages 里查看全部留言，把要公开的行的 `approved` 改成 true，刷新网站就能看到。访客填的邮箱只存数据库，前端读取时不查 email 字段，页面上不显示。已删掉原来写死的两条示例留言和只插页面的假提交逻辑；GitHub 联系链接已改成店主个人主页 `https://github.com/lanmaozdwyl`（显示 `@lanmaozdwyl`）。
- 权限：`guestbook_read_approved`（所有人只能读已通过的）、`guestbook_insert_own`（登录用户只能插入自己 user_id 的留言），没有给普通用户改 approved 的策略，不要加。SQL 没运行之前留言列表会提示先运行 SQL，页面其他内容照常浏览。
- 店主必须在 Supabase 后台做的事：审核留言时在表里改 `approved`，不要在聊天里发 service_role key。2026-11-01 店主指示微信和 B站暂时不显示：联系方式卡里微信链接、B站链接和微信二维码占位框已从首页删掉（Git 历史里还在，以后想恢复时加回来），只留邮箱和 GitHub。
- 占位内容未动：首页统计数字（42 / 128 / 36）、四张友链卡（链接都是 `#`），仍等店主提供真实资料或指示删除，本次没有编造或改动。

## 备忘录附件（2026-11-01 已推送到 main，待店主实测上传下载）

- 决定：2026-10-31 店主选了“什么文件都能传”。附件挂在备忘录条目下面：编辑时选文件，保存时在浏览器里用备忘录口令派生的密钥 AES-GCM 加密后上传到私有存储桶 `memo-files`，原文件名也加密后只存 `memo_files` 表；下载时在内存里解密后用原文件名保存。存储桶路径是 `<用户 id>/<随机 uuid>.bin`，不用原文件名。
- 限制：单个文件不超过 20 MB（Supabase 免费版全局上限 50 MB，代码再收紧到 20 MB），附件总量是免费版文件存储 1 GB，页面上显示已用量；删备忘录或删附件时同时删存储桶里的密文。`memo_files` 表和存储桶权限都是仅本人（`memo_files_owner` / `memo_files_storage_owner`，按用户 id 文件夹隔离）。SQL 没运行之前文字备忘录照常能用，附件会提示先运行 SQL，不要因此以为附件坏了。
- 店主已在 Supabase 后台做的事（2026-11-01 店主自报已运行 memo-files.sql）：匿名请求检查确认 `memo_files` 表已存在（未登录返回空列表）；但用 anon key 直接查存储桶返回 Bucket not found——anon key 可能看不到私有存储桶，不能据此断定存储桶没建好，推送后以店主实测上传为准；若上传报存储桶错误，先去后台 Storage 页面确认有没有 `memo-files` 私有存储桶，再重跑 SQL 里建桶和建策略的部分。不要在聊天里发 service_role key。

## 工具子站（2026-11-01 已推送到 main）

- 决定：2026-11-01 店主暂缓读书笔记子站，先做工具子站，并提到像 DeepL 这样的翻译软件可以放进去。工具子站放在同仓库的 `tools/` 目录，地址是 `/tools/`，跟主站同一个 Netlify 部署，不用新项目；可见范围跟主站一样（登录后可见，没有备忘录那种仅店主的额外限制）。
- 内容：`tools/index.html` + `tools.js`（分类筛选和搜索）+ `tools.css`（只补工具站没有的布局，卡片样式复用 style.css）。一共 15 个工具：翻译 4 个（DeepL 翻译器、Google 翻译、微软翻译、百度翻译，链接都已核对返回 200），其余 11 个跟首页工具箱一致（学术写作、编程开发各 4 个，设计与效率 3 个；首页工具箱里 DeepL 原来放在设计与效率下，工具站里只放在翻译类、链接到翻译器页面，首页不动）。卡片都是外部链接，在新标签页打开，本站不存这些工具的账号密码。想加新工具要店主提供名字和网址，不要编造。
- 配套改动：`auth-guard.js` 的登录页地址改成网站根目录的绝对路径 `/login.html`（子目录页面不再跳错，主站页面不受影响）；`login.js` 的登录后回跳白名单加了 `/tools`、`/tools/`、`/tools/index.html`（不加的话从工具站跳去登录，登录完会回到首页而不是工具站）。首页导航和工具箱区、商店导航都加了工具站入口。
- 读书笔记子站暂缓：2026-11-01 已查过 Notion 原文规模（约 4.3 万字、15 节、65 个折叠块、6 张内部图片链接，不能直接当网页图片用），试点方案和可见范围问题已问过店主，店主改主意先做工具站；以后再做笔记子站时重新确认可见范围，不要直接把 Notion 全文搬上网。

## 用户已确认的方向

- 保留现有黑白分区、渐变标题和柔和背景；参考 Apple 与 suzhe.ai 的观感及动效节奏。
- 兼顾手机和键盘操作，尊重 `prefers-reduced-motion`；不要让内容依赖动画完成才可阅读。
- 商店人工接单和发货，接单 QQ：`3126477562`。
- 用户表示已开通 suzhe.ai 代理；商品来自其代理页公开目录，实际供货由店主确认。
- 当前价格按 2026-10-31 参考站零售价加 5 元录入，不自动同步；修改价格需依用户指示，不能把供应商标价误当成本站售价。
- 现有售价：ChatGPT Plus 124、Pro 5x 680、Pro 20x 1075、Pro 500 3205；Claude Pro 165；Grok Plus 70、Premium 120、Super 365、Ultra 705；Super Duolingo 12（单位人民币元）。数据以 store.js 为准。
- 保留各产品激活条件和特殊售后说明。特别是 Duolingo 不保证使用时长，不能宣传为有保障的全年服务。

## 尚未实现 / 不应误报

- 无在线支付、订单系统、库存同步、自动采购或自动发货；咨询按钮只是打开 QQ 联系链接。
- 无供应商 API Key。其 API 文档描述激活流程，不代表已具备采购或支付能力。
- 留言板已接 Supabase（2026-11-01 本地做好、未推送）：留言存 `guestbook_messages` 表，需店主在后台把 `approved` 改成 true 才会公开显示；此前只插页面、刷新丢失的假提交逻辑和写死的示例留言已删除。
- 首页部分友链、社交链接、二维码、统计数字仍为原有占位或手填内容，需要店主确认后完善。
- 不要把密码、API Key、用户订单或登录凭据提交到公开仓库或写进前端。

## 换电脑开发（PowerShell 示例）

先安装 Git 与 Python。克隆后的路径由新电脑决定：

```powershell
git clone https://github.com/lanmaozdwyl/lanmaospace.git
cd lanmaospace
git status -sb
python -m http.server 8766 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8766/` 或 `/store.html`；结束预览按 Ctrl+C。若系统提供 `py` 而不是 `python`，用 `py -m http.server ...`。

已有克隆时先 `git status -sb`，确认没有待处理的本地修改，再 `git pull --ff-only`。不要覆盖其他电脑未提交的工作。

如安装了 Node，可做语法检查：

```powershell
node --check script.js
node --check store.js
node --check motion.js
git diff --check
```

验证桌面和手机显示、菜单、书单筛选、影视切换、商店分类与空搜索结果、详情关闭/Escape、QQ 链接、减少动态效果。不要为测试向真实 QQ 发送消息或支付订单。

## 提交与部署

当前网站功能版本为 `96e1511`（动效）；此前 `178c581` 为商店、`abe2142` 为视觉与手机适配。

完成修改后检查差异，只提交相关文件。不要无条件覆盖、强制推送或重置用户修改。确认要上线时推送 main；推送成功不等于部署成功，继续确认 Netlify 发布和正式网址资源。

GitHub 仓库公开，可直接克隆；推送需要有写权限的 GitHub 账号。Netlify 后台操作需要站点所属账号。不要要求用户在聊天里发送密码或令牌。
