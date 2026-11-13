# 历史报告状态说明（2026-11-04，2026-11-12 更新）

下方为 2026-11-03 的原始审查，保留当时证据，不代表当前版本。A1 格式配置已在远程；A2 测试清单已统一；A5 EPUB 注释已纠正；R1 按全站登录要求补齐阅读器前端守卫与回跳。README 构建说明与上手/备份提醒已更新，HANDOFF 顶部记录当前状态。

R2 SDK 自托管已于 2026-11-12 落地：Supabase SDK 不再从 jsdelivr 动态导入，改为 lib/vendor/supabase-js-2.39.0.mjs，CSP 的 script-src 收紧到只剩 'self'（_headers 与 netlify.toml 同步）；来源与哈希见 lib/vendor/vendor.json，复核跑 scripts/vendor-supabase-sdk.mjs，回归在 tests/sdk-vendor.test.mjs。R3 权限测试已在本地用 PGlite 跑通（tests/permissions.test.mjs 144 项，含线上迁移体检脚本 space-schema-check.sql 的通过/失败两分支）。收录策略另由 tests/seo-policy.test.mjs 守住。A3 历史文档归档、A4 旧资源清理（仓库内过期 lanmaospace.apk 与 netlify.toml 双份头部）仍待店主确认，本轮没有据此删除文件。

R2 落地当天补两处：一是自己踩回来的坑——给 /lib/vendor/* 加了一年 immutable，线上实测 Pages 把所有命中的规则**拼接**而不是覆盖，返回的是 `Cache-Control: no-cache, public, max-age=31536000, immutable`，no-cache 要求每次回源校验，max-age 永不生效（87af9f3 当年正是为此清掉过七条同类规则）。死规则已删除，理由写进 _headers，tests/sdk-vendor.test.mjs 会拦住再被加回来；全站缓存边界维持 no-cache 重新验证不变。**（这句到 2026-11-13 已失效：no-cache 已从 /* 移到逐条文档上，静态资源改走 5 分钟 max-age，见下文"加载与响应速度"一段。）**二是新增 tests/reference-integrity.test.mjs，从三个方向守住引用：站内引用必须存在、被引用的文件必须在 build.mjs 白名单里（FAQ 那次漏进 dist 就是这个坑）、images 与 audio 不留无人引用的死重量；同一条测试里带反向控制，并另建临时页面端到端验过两类断言确实会红。当前功能测试 320 项（另 tests/permissions.test.mjs 需 PGlite，144 项）；真实账号/真机及线上数据库状态仍以当前验收为准。

2026-11-13 留言板点赞：数据层 `supabase/guestbook-likes.sql` 建 `guestbook_likes`（复合主键即天然幂等，删除留言按外键级联），不给任何角色直接表权限、一条 RLS 策略都不建，读写全部走两个 `security definer` 且 `set search_path=''` 的函数；未过审留言与不存在的 id 返回同一句提示，避免拿点赞接口探测后台留言。前端在 `guestbook.js` 里乐观更新＋服务端回填纠偏，取会话之前就占住 pending 标记（否则两连点会并发两个请求、后回来的把状态翻反），失败一定退回原计数；动效按参考站的动画词汇用 WAAPI 实现（心形 pop 420ms 过冲曲线、扩散环 scale(.55)→2 淡出、数字上浮 220ms），`prefers-reduced-motion` 下全部不播、状态照常更新，样式与事件绑定都不内联，CSP 不受影响。迁移没执行时 `guestbook_like_state` 调不通，整排按钮收起，而不是留一个点了必报错的心形。测试：新增 `tests/guestbook-like.test.mjs`（vm＋最小假 DOM 跑真实模块；假 DOM 的 click 必须冒泡，否则事件委托那条测试是假的）8 项，功能测试合计 328 项；`tests/permissions.test.mjs` 扩到 167 项 PGlite 检查，含 `guestbook-security-check.sql` 点赞分支的通过/失败两面（故意多 grant 一条权限必须先报 FAIL）。线上数据库仍需店主执行 `supabase/guestbook-likes.sql`，本机连不上 Supabase，这一步不能代替真实账号验收。

同日在真浏览器里验收点赞时发现整片深色样式是死的，顺带清了 CSS 的两类结构性错误（浏览器实测取证，不是读代码猜的）：一是 `body[data-theme="dark"] .x,` 换行紧跟 `@media (prefers-color-scheme: dark) {…}` 的写法，选择器列表里混进 at-rule 属于解析错误，Chrome 把整块丢掉——style/auth/memo/profile/reader 五个文件共 10 处，实测留言板快捷标签在深色下仍是 #424245 的深灰字压在 #1c1c1e 卡片上（等于看不见），密码可见性按钮、备忘录标签、专注钟键帽、 zen 卡片背景等同理；现已拆成"显式 dark 一条 + `@media (prefers-color-scheme: dark)` 里 `body:not([data-theme="light"])` 一条"，改完深色下 pill 变 rgb(209,209,214)、卡片底 rgba(255,255,255,.06)，浅色一个像素没动。另一头还有 2 处反向错误：`body:not([data-theme="light"])` 写在媒体查询外面，系统浅色且没手动选主题时也会糊上深色样式（首页搜索的建议胶囊和清除键），已收进 dark 查询里。二是全站 4 个未定义就使用的自定义属性：`--primary`（留言板重试按钮强调色，自 init 起就没生效过，改成 `--blue`）、`--gray-700`、`--gray-300`（tools 三处）、`--r-text-primary`（阅读器导出按钮，正主是 `--r-text`）；未定义变量的声明在计算值阶段整条失效，表现为"颜色悄悄回退成继承值"，很难从代码上看出来。防复发交给 `tests/css-theme-guards.test.mjs`：只认 `{ } ;` 的结构扫描，不依赖换行缩进，三条检查各带通过/失败两面反向控制（改完实测 95 条自动深色规则全部落在 dark 查询内、0 条裸写）。功能测试 331 项。

## 加载与响应速度（2026-11-13）

先量再改：`/` 首屏 4 个 CSS、`/reader.html` 4 个 CSS 加 6 个脚本，**没有一个带 defer**，且每一个都因为全站 no-cache 每次导航回源校验；本机实测 TTFB 1.25–3.57 s、响应 `Content-Encoding: br`、`/reader.js` 362 KB（75 KB br）。四处改动：

1. **defer 全部经典脚本**（10 个页面 22 个标签）。`type="module"` 本来就是延迟执行，defer 脚本与它同属一个队列、按文档顺序跑，所以 `memo-config.js` 排在使用它的模块之前这个约束仍然成立——新增 `tests/script-defer.test.mjs` 把"没有 defer"和"顺序倒了"两件事都钉住（后者错了不报错，只是悄悄地拿到 undefined，登录起不来很难查）。
2. **缓存反过来写**：`Cache-Control: no-cache` 从 `/*` 摘掉，改成 `/*` 上 `public, max-age=300`、12 个 HTML 页加 `/`、`/tools/` 逐条点名 no-cache。利用的正是上面那条拼接语义——`no-cache` 拼在 `max-age` 后面依然优先，所以文档不会真被缓存，而漏写一条的后果只是那个页面最多多缓存 5 分钟。5 分钟是刻意的：文件名没有内容哈希，HTML 与 JS/CSS 不同版本最多错开这么久。`tests/sdk-vendor.test.mjs` 原来拦的是"子路径上别加 max-age"，现在改成拦"max-age 只准出现在 /*、每个页面的两种 URL 写法都必须被点名"，两面都有反向控制。
3. **`/sbproxy` 响应显式 no-store**（`_worker.js`）。实测过 `_headers` 只作用于静态资源，worker 亲手造的响应没人管：一旦上游哪天给了可缓存的头，边缘节点就会把某个用户的行数据回给后面所有人。顺手删掉转发头里的 `content-encoding`/`content-length`——body 取回来时已经解压过了。
4. **阅读器滚动不再每帧重扫全文档**。旧代码每个 scroll 事件 `querySelectorAll('.scroll-chapter-section')` 再逐节读 `offsetTop`＋`offsetHeight`，而同一个回调末尾 `updateSlider()` 要写样式，于是下一帧的读必然触发整卷强制重排；长卷读到第 20 章时一次惯性滑动就是几十次重排。现在分区顶边缓存成数组＋二分定位，只在追加新章、`applySettings()`、resize、重渲染时作废，回调本身按帧合批。附带把 `updatePaginationMetrics` 里查两遍段落、读两次视口宽度的浪费去掉，并给"视口 0 宽就下一帧重测"的自愈循环加了 30 次上限——原来容器一直是 0 宽（后台标签页）就会以 60 Hz 强制重排并连带写 localStorage。新增 `tests/reader-scroll-perf.test.mjs` 用假 DOM 数读取次数（5 趟定位只准读 3 次，作废后才重测），真浏览器里从第一章滚到第五章再滚回来，页眉与百分比都跟着走。

**发版后线上实测（7255c07）**：静态资源这一半按预期生效——`/style.css`、`/reader.js` 返回干净的 `public, max-age=300`，不再每次导航回源；`/` 拼出 `public, max-age=300, no-cache`，说明"拼接而不是覆盖"这个前提是真的。但顺着真实加载路径查下去发现只修好了一半：Pages 默认开 clean URL，`/reader.html` 只回 308，浏览器实际缓存的是 `/reader` 那条响应，而 `_headers` 里点名的是 `.html` 写法，`/reader` 只命中 `/*`，拿到的是**没有 no-cache 的 5 分钟缓存**——`/memo`、`/profile`、`/space`、`/store`、`/account`、`/faq`、`/login`、`/offline`、`/404` 全部如此。已给每个文档补上 clean URL 那条规则，`tests/sdk-vendor.test.mjs` 的点名检查从"每个 `*.html`"改成"每个页面的两种写法"（用 `documentForms()` 推导，并做了删一条就变红的反向控制）。教训是判断缓存头是否生效只能按浏览器真正加载的 URL 取头，看仓库里的文件名会得出错误结论；另外 `/nonexistent` 这类猜不出来的路径仍只命中 `/*`，后果是 404 页最多缓存 5 分钟，可接受。

**复验 0aa6b38 后的剩余开销（浏览器 PerformanceTimeline 实测，不是推断）**：逐条 URL 取头已全绿——13 个文档 URL 全部拼出 `public, max-age=300, no-cache`，静态资源全部是纯 `public, max-age=300`。但换页时本页面的小资源仍普遍拿到 `transferSize≈300` 的 304，只有 `style.css` 稳定 0 字节命中。为排除"缓存没生效"的误判，做了隔离实验：同一 URL 在页面内连续 fetch 三次，第一次 1713 B/424 ms，后两次 **0 B/2–3 ms**，说明 300 秒 TTL 本身是严格遵守的，导航时的 304 是 Chrome 在"文档必须重新验证"那一趟里顺带校验子资源的行为，代价是每条约 300 字节的往返，不是重新下载 body（body 字节没再传：首屏实测有 114 KB 直接从缓存出）。唯一稳定的 0 字节命中是 `style.css`，它正好在 `sw.js` 的 `ASSETS` 拦截名单里，这是当前唯一能确定归因的线索，不是结论。真要再压这一档，路只有两条：文件名带内容哈希后把 max-age 提到一年（此时校验与否已无关），或把静态资源纳入 SW 拦截；两者都要先解决"覆盖同名文件会让长缓存把旧版本钉住"这个前提，本轮没做。


**量过之后决定不做**：把 `BUILTIN_BOOKS`（83.5 KB raw / 24.7 KB br，占 reader.js 传输的三分之一）拆成独立 defer 文件。字节总量不变、两个文件仍然要按顺序执行、还多一次请求往返，唯一收益是缓存粒度，而阅读器只有这一个页面会加载它——不值得动。真正有价值的是把正文改成"打开某本书时再取"，但那要求把 `chapters[].content` 从书架元数据里剥出来，而全文检索、TTS、备份导出十几处都直接读 `state.books[id].chapters[i].content`；导出是用户本地书的唯一备份通道，做成半成品等于拿数据换体积。`initCustomBooksStorage` 用 `store.getAll()` 一次性把所有书（含 PDF 的 base64）克隆进主线程这件事同理，是要改就得连带把导出、检索、进度全部重验的一次结构性改动，本轮没有做。

---

# Lanmao Space 审查报告（AUDIT）

审查日期：2026-11-03。方式：阅读代码与配置，在隔离沙箱运行 node scripts/check.mjs，用本地静态服务探测页面返回。未修改任何现有文件，未执行 build，未做真实浏览器和 Supabase 联调。

## 一、基线（已验证）

- 技术栈：原生 HTML/CSS/JS 静态站；Supabase 负责登录、留言、备忘录、成员空间；Android WebView 壳在 android/；部署到 Cloudflare Pages（构建 node scripts/build.mjs，输出 dist）。
- node scripts/check.mjs：全部 JS 语法检查通过，185 项 Node 测试通过，0 失败。
- 本地静态服务：index、reader、login、store、memo、space、profile、account、faq、tools/、404、offline、manifest、sw、products.json、audio/manifest.json 均返回 200。
- 页面资源引用 165 处，无缺失文件。唯一不在 dist 白名单的是 lanmaospace.apk，由 _redirects 302 到 GitHub Release，属于设计如此。
- 未验证：真实浏览器渲染与交互、响应式、Supabase 登录/留言/备忘录真实流程、SQL 权限测试（需要 PGlite，沙箱没有）、线上站点、Android 真机。

## 二、已验证的问题

### A1 [中] Git 工作区 101 个文件显示已修改，实为行尾差异
- 证据：git diff --stat 为 12697 插入/12697 删除；加 --ignore-all-space --ignore-cr-at-eol 后 diff 为空。git ls-files --eol 显示 85 个文件 i/lf w/crlf，16 个 w/mixed。仓库没有 .gitattributes 或 .editorconfig，core.autocrlf=false。
- 影响：git status 全是噪音，真实修改会被淹没，审查和合并冲突都容易出错。
- 建议：新增 .gitattributes（* text=auto eol=lf）和 .editorconfig。不要在未确认前重写用户工作区文件。

### A2 [中] npm test 与 scripts/check.mjs 的测试清单不一致
- 证据：package.json 的 test 只列 11 个测试文件；check.mjs 列 19 个。npm test 漏掉 ambient、android-export、focus、mobile、reader-audio、reader、signout、ui-layout 共 8 个。permissions.test.mjs 因需要 PGlite 单独成项，属于有意区分。
- 影响：开发者运行 npm test 会得到通过，但阅读器等核心模块没有被覆盖；CI 和 build 走 check.mjs，所以线上不受影响。
- 建议：让 npm test 直接调用 node --test tests/*.test.mjs（排除 permissions），或统一由 check.mjs 维护清单。

### A3 [低] 文档与现状不一致，HANDOFF.md 过长且含过期信息
- 证据：HANDOFF.md 约 44 KB，顶部为 11-03 状态，下方仍保留 netlify.app 为正式站、测试 48 项等旧描述；各文档中测试数量为 34、48、108、147、181、185 多个版本。README 写无需 npm 与构建，但部署实际执行 node scripts/build.mjs。
- 影响：新接手者容易以旧信息为准。
- 建议：把权威状态压缩到 README 与 TASKS，HANDOFF 的历史段落归档到 docs/history。

### A4 [低] 仓库中保留已过期的 lanmaospace.apk，netlify.toml 与 _headers 重复
- 证据：根目录 lanmaospace.apk 为 19,268 字节，被 git 跟踪；ANDROID-GUIDE 说明新版发布在 GitHub Release，仓库内旧 APK 不再打包。netlify.toml 的 CSP 等头部与 _headers 逐项重复，而 Netlify 已不是正式站（NEXT-AGENT-PROMPT.md 第 12 行）。
- 影响：旧 APK 容易被误当成最新版；两处头部配置会漂移。
- 建议：确认后移除旧 APK 和 netlify.toml；CSP 只在 _headers 维护。删除跟踪文件属于需要你确认的操作。

### A5 [低] reader.js 头部注释与实际能力不符
- 证据：reader.js 头部写支持 TXT/MD/EPUB 导入；reader.html 的文件选择只接受 .txt/.md，reader.js 第 1975 行对 .epub 做拒绝处理。
- 影响：只是注释误导，不影响功能。
- 建议：修正注释。

## 三、需要进一步验证的风险

### R1 reader.html 没有登录守卫
- 证据：auth-guard.js 被首页、商店、备忘录、成员空间、账号、头像、FAQ、工具站加载，但 reader.html 没有；login.js 的回跳白名单也不含 /reader.html。阅读器数据在浏览器本地（localStorage、IndexedDB），不涉及 Supabase。
- 判断：HANDOFF 称整站需登录，但首页主入口是阅读器，可能是有意让阅读器公开可用。这是产品决策，不能擅自改。
- 需要你确认：阅读器是否应免登录。

### R2 Supabase SDK 从 CDN 动态导入，没有完整性校验
- 证据：lib/supabase-client.js 导入 cdn.jsdelivr.net 上固定版本 2.39.0；CSP 的 script-src 允许整个 cdn.jsdelivr.net。版本已固定，但动态 import 无法加 SRI。
- 影响：CDN 被入侵时可执行任意脚本。登录页与备忘录会受影响，风险等级取决于对 CDN 的信任。
- 建议：把 SDK 自托管到 lib/vendor，并把 CSP 收紧到 self。需要网络下载依赖，当前沙箱没有网络，需在可联网环境验证。

### R3 SQL 权限与 Supabase 配置
- 证据：supabase/*.sql 中 RLS、限制性策略、列级授权写得严谨，memo-owner-security.sql 校验店主 UID；但 tests/permissions.test.mjs 本次未运行。
- 判断：未验证。需要 PGlite 环境，CI 中有对应步骤。

### R4 响应式与交互未实测
- 文档称 320/390/768 宽度已核验，但本次沙箱没有浏览器，无法独立复核。UI 阶段会在可用环境中实测。

## 四、已核对、不属于缺陷的事项

- memo-config.js 中的 anon key 与 ownerUid：设计上就是公开给前端的，依靠 RLS 保护；全仓库未发现 service_role 或 secret key。
- innerHTML 使用：reader.js 对书名、章节和正文先 escapeHtml 再写入；script.js 的搜索索引是写死的常量；guestbook.js 和 profile.js 用 textContent。未发现可被用户输入利用的 XSS。
- 前端登录守卫只是软门禁，代码和文档都已明确说明，不是缺陷。
- service worker 只缓存离线页和静态资源，不缓存页面与用户数据，范围保守合理。
- 备忘录加密、留言审核、头像与成员空间的权限设计未发现问题。

## 五、个人风格偏好（不计为缺陷）

- 部分文件压缩成单行风格（sw.js、check.mjs、build.mjs、memo-config 等），可读性一般，但能运行且有测试。
- 缩进与引号风格不统一（4 空格与 1 空格、单双引号混用）。
- 文件混放在根目录，没有 src 目录。

## 六、可维护性观察（需评估，非紧急）

- reader.js 已长到 6792 行、362 KB（75 KB br），内置三本书的全文与阅读器逻辑在同一个 IIFE 中；style.css、reader.css 各约 111 KB / 95 KB。体积和耦合偏高，但有 reader 测试覆盖。
- 拆分建议见文首"加载与响应速度"一节：内置书籍数据单独成文件这条已经量过并否决，真要动体积应动"正文按需取"，而那是连带导出、检索、进度一起重验的结构性改动，不要在没有验收手段的情况下顺手做。

## 七、结论与改造建议

**是否需要整体重写：否。** 理由：全部语法与 185 项测试通过；构建白名单与页面引用一致；权限与安全设计整体扎实；没有发现会导致无法运行、数据错误或核心功能失效的缺陷。重写会丢掉大量已验证的行为，成本高、迁移风险大，收益不明确。

**保留：** 整体架构（静态站加 Supabase）、lib/ 下的模块、supabase/ 下的 SQL 与权限策略、tests/ 与 CI、Cloudflare 构建流程、service worker。

**直接修复（低风险，可推进）：** A1 加 .gitattributes/.editorconfig（不重写现有文件）；A2 统一测试入口；A5 修正注释；A3 整理文档。

**需要你确认后再做：** R1 阅读器是否免登录；A4 删除旧 APK 与 netlify.toml；R2 自托管 SDK；以及一旦启动，将 reader.js、style.css 拆分的范围。

**UI 阶段：** 功能稳定后再做，需要你提供用途偏好、目标用户和设计参考；缺失时我会按现有首页风格（黑白分区、柔和渐变）给出可运行预览。
