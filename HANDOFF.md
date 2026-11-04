# 在线阅读器：连续长卷 (Scroll) 模式移动端防假死轻触唤起菜单、滑块进度百分比实时映射与步进平滑翻页（2026-11-04 晚）

本节优先于下方历史记录。针对移动端在“连续长卷 (Scroll)”模式下手势与热区同时失效导致用户无法呼出顶底栏退出阅读的“假死”陷阱，以及底栏进度滑块在长卷模式下被锁死、上一页/下一页无效等核心交互缺陷进行系统性修复与架构重塑：
1. 解决连续长卷模式下触屏“假死”与无法唤起顶底栏菜单的严重缺陷（`reader-gesture.js` / `reader.js`）：
   - 根因分析：在移动端触控屏上（`@media (pointer: coarse)`），为允许用户自由选中文字，`.reader-touch-zones` 设置了 `pointer-events: none;`；而原代码中 `gestureEnabled()` 在长卷模式下直接返回 `false`，导致 `ReaderGesture` 的 `touchStart` 监听被完全挂起跳过；双重失效导致移动端长卷模式下点击无任何反应，用户一旦进入长卷全屏即被“永久困住”无法呼出菜单退出；
   - 架构升级：在 `reader-gesture.js` 中新增 `_swipeEnabled()` 判断支持配置 `cfg.isSwipeEnabled`，并在横向滑动拦截处增加该守卫，使长卷模式下不拦截原生纵向滚动（无卡顿无撕裂），但保留精准的触控点按检测（`onTap`）；
   - 交互闭合：在 `reader.js` 中为手势机注入 `isSwipeEnabled: () => state.settings.mode !== 'scroll'`；当长卷模式下检测到轻触时，直接触发 `toggleMenu()` 呼出/隐藏顶底栏；同时在 `reader-viewport` 上增设兜底 click 监听，在未选中文本时点击正文区域同样能顺畅切换菜单。
2. 修复底栏进度滑块在长卷模式下失灵与 0~100% 视口滚动映射联动（`reader.js`）：
   - 根因分析：长卷模式下 `totalPages = 1` 且 `currentPage = 1`，旧版滑块取值为页码导致滑块被锁死在 1 无法拖动；
   - 算法重构：在长卷模式下将 `#reader-page-slider` 动态映射为 0~100% 的滚动进度百分比，通过 `scrollTop / (scrollHeight - clientHeight)` 精准计算当前进度；拖动滑块时平滑同步滚动正文视口，并实时更新底栏百分比提示与章节标题；
   - 滚动反向联动：在 `reader-viewport` 滚动监听中，长卷模式下实时调用 `updateSlider()`，使用户随手滑动阅读时，底栏滑块即时跟随前进。
3. 扩展长卷模式下的上一页/下一页步进翻页与跨章跃迁（`reader.js`）：
   - 在长卷模式下调用 `nextPage()` 与 `prevPage()` 时，不再做无效的页码累加，而是以当前视口高度的 85%（`viewport.clientHeight * 0.85`）进行平滑步进滚动（`scrollBy({ behavior: 'smooth' })`）；
   - 到达当前章节底端或顶端时，顺畅衔接上一章或下一章，带来连贯自然的阅读流体验。
4. 全站 292 项自动化测试（新增手势引擎长卷模式轻触及阅读器长卷滑动/滑块映射/步进翻页回归测试）、语法安全检查与 clean `dist` 构建 100% 顺利通过。

---

# 在线阅读器：彻底移除侧边虚拟音量翻页键、修复 PDF 多页加载与翻页联动、扩充开源小说/古登堡书库（2026-11-04 晚）

本节优先于下方历史记录。针对用户反馈的“PDF 上传只显示第1页无法往后翻”、“虚拟音量翻页键再次出现未彻底删除”以及“在线找书来源太少”三大核心问题进行系统性治理与深度优化：
1. 彻底移除侧边虚拟翻页键（`reader.html` / `reader.css` / `reader.js` / `tests/reader.test.mjs`）：
   - 彻底删除 `#reader-edge-rocker` 悬浮节点、`#btn-toggle-edge-rocker` 开关及所有 `.rocker-*` 样式规则；
   - 彻底清除 `edgeRockerEnabled` 设置项记忆读取、事件监听绑定及提示文案；
   - 重构自动化测试，增加严密的反向回归断言，防止未来任何误引或意外复活。
2. 修复 PDF 多页加载瓶颈与翻页/手势交互联动（`lib/pageflipopen/pageflipopen.js` / `reader.js`）：
   - 根因解决：原引擎在 `load()` 时逐页顺序 `await getPage(i)` 导致 50~100 页文档引发数十次 Worker 往返阻塞，`onReady` 无法触发且总页数假死在 1；引入 `numPages > 8` 快速映射通道（0ms 零阻塞），页面随翻随渲染；
   - 屏幕排版自适应：小屏移动端（`containerW < 768px`）自动启用 `singlePageMode: true`，单页全宽阅读不挤压；
   - 目录与底栏按钮全量打通：`onReady` 与 `onPageChange` 实时构建 `第 1 页` 到 `第 N 页` 目录列表，底栏上一章/下一章自动变更为“上一页/下一页”，状态精准联动；
   - 触控热区与手势滑动无缝集成：修复手势引擎在 PDF 模式下的拦截逻辑，支持左右点击翻页、中区呼出菜单、左右滑动手势翻页。
3. 在线找书来源扩充与开源小说检索接入（`reader.html` / `reader.css` / `reader.js` / `_headers`）：
   - 接入古登堡计划（Project Gutenberg / Gutendex）：收录全球 70,000+ 免费公版原著，免翻墙一键检索，并支持纯文本正文抓取、流式分章后一键入库；
   - 接入精选开源小说与书源检索导航：内置鸠摩搜书、苦瓜书盘（6万+开源小说）、书格数字古籍图书馆、周读等优质平台，提供快捷直达与直链复制教程；
   - 扩充精选公版名著大书库：新增鲁迅《呐喊》《彷徨》、蒲松龄《聊斋志异》、吴敬梓《儒林外史》、许仲琳《封神演义》、沈复《浮生六记》、司马迁《史记精选》、庄子《逍遥游》等 14 部传世经典，开箱即读；
   - 安全加固：修复 `online-custom-fetch-btn` 中对未定义函数 `parseTxtBook` 的潜在异常调用，统一为 `parseUploadedFile`；并在 `_headers` CSP `connect-src` 中正式授权 `gutendex.com` 与 `gutenberg.org`。
4. 全站 289 项自动化测试（新增 PDF 多页联动与开源书库扩展测试）、语法安全检查与 clean `dist` 构建 100% 顺利通过。

---

# 全站深色模式：配置 color-scheme: dark，统一夜间原生滚动条与弹窗磨砂遮罩视觉层级（2026-11-04 晚）

本节优先于下方历史记录。针对全站深色模式在 iOS Safari、Blink/WebKit 移动端浏览器中缺少原生色彩方案声明、导致系统原生滚动条与弹窗选择器出现刺眼白色亮斑，以及弹窗遮罩背景在 OLED 屏幕上对比生硬的问题进行系统性视觉层级与人机工程升级：
1. 注入原生 `color-scheme: dark;` 规范（`style.css` / `store.css`）：
   - 在 `[data-theme="dark"]`、`:root:not([data-theme="light"])`、`body[data-theme="dark"]`、`body:not([data-theme="light"])` 以及弹窗 `dialog` 上显式声明 `color-scheme: dark;`；
   - 彻底解决移动端 iOS Safari 在深色页面下弹出原生表单输入控件、系统选择器与主屏 Home 指示器时出现白底反光的刺眼 Bug，全面提升 OLED 屏幕夜间暗光护眼体验。
2. 移动端与全站暗黑滚动条（`::-webkit-scrollbar`）精细化适配：
   - 为暗黑模式下的内部滚动区域与弹窗配置 8px 极简滚动条，轨道完全透明（`background: transparent;`），滑块采用 20% 半透明白色（`rgba(255, 255, 255, 0.2)`）与全圆角胶囊设计（`border-radius: 999px;`），悬停时增亮至 35%，视觉层次柔和自然。
3. 弹窗深色磨砂遮罩（Backdrop Blur）增强：
   - 将商店商品详情弹窗（`store.css`）与全站原生对话框（`style.css`）在暗黑模式下的背景遮罩升级为 `background: rgba(0, 0, 0, 0.72-0.75)` 并叠加 12px-14px 硬件加速磨砂毛玻璃滤镜（`backdrop-filter: blur(12px-14px); -webkit-backdrop-filter: blur(12px-14px);`），消除直切割黑框的生硬突兀感。
4. 全站 288 项自动化测试（新增全站深色模式 color-scheme 与磨砂毛玻璃回归用例）、语法安全检查与 clean `dist` 构建 100% 顺利通过。

---

# 在线阅读器：自定义书籍二次确认防误删与书签/笔记级联清理（2026-11-04 晚）

本节优先于下方历史记录。针对在线阅读器书架大厅（`reader.html` / `reader.css` / `reader.js` / `tests/reader.test.mjs`）中自定义书籍（本地导入的 EPUB/TXT/PDF）在移动端点击易误触删除按钮、且删除时直接硬删除导致珍贵书籍与阅读记录永久灭失，以及残留书签/划线笔记产生孤儿垃圾数据的严重隐患进行全链路安全治理：
1. 二次确认防误删安全守卫（`confirmDeleteCustomBook`）：
   - 点击书卡删除按钮（`.card-delete-btn`）时不再直接执行物理删除，必须弹出明确清晰的二次确认对话框（`确定要从书架移除《xxx》吗？已导入的本地离线文件、阅读进度以及该书的所有书签和划线笔记将被彻底删除，此操作无法撤销。`）；
   - 用户取消时 100% 保持现状不丢数据，仅当用户显式点击确认后才执行删除操作。
2. 级联深度清理孤儿书签与划线笔记：
   - 彻底解决旧版 `deleteCustomBook` 仅删除书籍主体和进度，但遗留 `STORAGE_KEY_BOOKMARKS` 与 `STORAGE_KEY_HIGHLIGHTS` 孤儿记录的问题；
   - 删除书籍时自动级联剔除 `state.bookmarks[bookId]` 与 `state.highlights[bookId]`，同步调用 `saveBookmarks()` 与 `saveHighlights()`，并即刻刷新书签与划线笔记徽章计数，杜绝存储泄露与脏数据堆积。
3. 移动端人机工程与视觉优化（`reader.css`）：
   - 为 `.card-delete-btn` 注入毛玻璃背景（`backdrop-filter: blur(4px)`）与细微边框，小屏端（`max-width: 768px`）触控靶心从 24px 优化扩大至 30px×30px，并配置 `touch-action: manipulation;` 与按压缩放动效，兼顾醒目标识与精准防误触。
4. 全站 287 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 全站 Spotlight 搜索（Ctrl+K）：深度收录蓝昴工具箱、常见问题 FAQ、多维拼音/别名检索与空状态建议胶囊（2026-11-04 晚）

本节优先于下方历史记录。针对全站快捷搜索（`index.html` / `style.css` / `script.js` / `tests/ui-layout.test.mjs`）仅有 9 个主模块且缺乏深度工具索引、输入框无法快捷清空、无匹配时仅有冷冰冰文字的问题进行功能扩容与体验升级：
1. 深度收录实用工具与常见问题总入口（扩容至 27 个检索实体）：
   - 深度收录工具箱总入口（`tools/index.html`）及 15 个常用外部高质量工具（DeepL 翻译、Google 翻译、微软翻译、百度翻译、Overleaf、Zotero、Notion、Google Scholar、VS Code、GitHub、Google Colab、Anaconda、Figma、Excalidraw、Todoist），配有精准分类（`工具·翻译`、`工具·学术`、`工具·开发`、`工具·设计`、`工具·效率`）与专属图标；
   - 深度收录常见问题总入口（`faq.html`，帮助与售后说明）；
   - 严格遵守业务边界防线：未上线的商店页面（`store.html`）严禁收录。
2. 多维拼音、英文别名与同义词关键词检索（`keywords`）：
   - 为每个条目配置丰富的拼音、英文与同义词（例如搜 `latex` / `paper` / `xueshu` 均能精准命中 Overleaf 和 Zotero；搜 `fanyi` 命中各大翻译器；搜 `daima` 命中 VS Code 与 GitHub；搜 `pomodoro` 命中专注钟；搜 `shujia` 命中阅读器）；
   - 搜索算法同时对 `title`、`category`、`keywords` 进行大小写不敏感检索。
3. 交互体验升维：快捷一键清空与智能建议胶囊：
   - 搜索框内增加交互式清空按钮（`.spotlight-clear`），输入即显、点击即清并自动重获焦点；
   - 支持键盘优雅退格体验：在输入框内按 `Escape`，若有输入内容则优先清空输入框并重置结果；第二次按 `Escape` 或空文本时直接关闭搜索弹窗；
   - 空状态友好升级：无匹配结果时显示 `🔍 未找到与 “...” 匹配的内容`，并附带一组可点击的推荐搜索胶囊（阅读器、工具箱、翻译、白噪音、账号安全），点击直接填入并即时搜索。
4. 全站 286 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 在线阅读器：书架置底工具栏 40-42px 人机工程学靶心与小屏防误触升级（2026-11-04 晚）

本节优先于下方历史记录。针对在线阅读器书架大厅（`reader.html` / `reader.css` / `tests/reader.test.mjs`）在手机窄屏置底导航栏中，4 个核心快捷图标（🎧 伴读声音、🍅 学术专注钟、🎨 背景主题、♙ 个人空间）尺寸过小（原 34px–36px）且间距紧密，大拇指单手极易发生误触按错的核心痛点进行人机工程学重构：
1. 底栏快捷按钮尺寸与间距全面靶心化（`@media (max-width: 640px)`）：
   - 将 `.shelf-tool-btn` 统一从 36px 扩大至 `42px×42px` 标准触控靶心（`min-width: 42px; min-height: 42px; font-size: 17px;`），并配套注入微弱背景对比与按压缩放反馈（`transform: scale(0.92)`）；
   - 注入 `touch-action: manipulation;`，消除移动端双击延迟。
2. 360px–380px 极窄屏智能避让与防误触保障（`@media (max-width: 380px)`）：
   - 彻底摒弃以往将按钮缩小为 34px 的反人机工程做法；
   - 智能隐藏极窄屏下冗余的书架静态主标题（`.shelf-brand-title`），释放 60px–80px 横向可用空间；
   - 将返回按钮精炼为 `‹` 40px 高触控区，为右侧 4 个工具按钮留足空间，确保在 iPhone SE、小屏安卓设备上依然享有宽松从容的 `40px×40px` 触控靶心与 6px 间距，彻底消除按错相邻功能的烦恼。
3. 全站 285 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 伴读白噪音：触控滑块防页面晃动抖动与静音/定时人机工程学升级（2026-11-04 晚）

本节优先于下方历史记录。针对伴读声音卡片（`index.html` / `style.css` / `tests/ambient.test.mjs`）在触屏手机与窄屏机型上调节音量引发页面剧烈上下抖动、静音按钮靶心狭小易误触的问题进行系统化升级：
1. 音量滑块 `touch-action: none` 手势防抖隔离：
   - 为 `.ambient-vol-slider` 注入 `touch-action: none;`，彻底切断水平拖动滑块时系统误判的纵向页面滚动触发，滑动调音量顺滑稳定、页面零抖动；
   - 在 `@media (max-width: 600px)` 下将滑块 Thumb 尺寸从 14px 扩大至 22px×22px（同时适配 WebKit 与 Firefox Gecko `::-moz-range-thumb`），消除大拇指遮挡与脱手。
2. 静音按钮与音量外框 44px 人机工程学靶心化：
   - 将静音切换按钮（`.ambient-vol-btn`）在手机端扩展为 `min-width: 44px; min-height: 44px; font-size: 16px;`，并配置 `touch-action: manipulation;`；
   - 整体音量胶囊外框（`.ambient-vol-wrap`）注入 `min-height: 44px;`，方便单手大拇指快速盲操一键静音/恢复。
3. 声音卡片窄屏内边距瘦身与定时胶囊换行自适应：
   - 将 `.ambient-card` 窄屏内边距由 36px 瘦身至 `24px 16px 20px`，释放 40px 横向可用空间；
   - 定时胶囊容器（`.ambient-timer-select`）开启 `flex-wrap: wrap; gap: 8px;`，各档位胶囊（`.ambient-timer-pill`）扩展至 44px 高度与 44px 宽度，彻底消除窄屏手指挤压与误触。
4. 全站 284 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 登录与认证页：补全 viewport-fit=cover 视口元标签与刘海屏安全区避让（2026-11-04 晚）

本节优先于下方历史记录。针对登录认证页（`login.html` / `tests/login-security.test.mjs`）在全屏 PWA、微信 Webview 及 iOS Safari/全面屏机型上因遗漏 `viewport-fit=cover` 导致状态栏与刘海安全区失效的系统 Bug 进行修复：
1. 视口元标签补齐：
   - 将 `<meta name="viewport" content="width=device-width, initial-scale=1.0">` 补全升级为 `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`；
   - 与全站其余页面保持 100% 一致，使得 CSS 中 `padding-top: calc(72px + env(safe-area-inset-top, 0px))` 能够正确读取系统状态栏与灵动岛切角高度，消除顶栏返回链接与刘海硬件重叠遮挡。
2. 全站 282 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 阅读器正文白屏空显与零宽崩溃修复、移动端状态栏刘海遮挡全站系统化治理（2026-11-04 晚）

本节优先于下方历史记录。针对用户反馈的核心严重 Bug（书架书籍点击进入后正文一片空白空显、手机顶栏文字「蓝昴空间」被手机状态栏遮挡）进行深度代码追查与全链路架构修复：
1. 书架点击书籍「一点东西都没有」白屏空显根因与修复（`reader.css` / `reader.js`）：
   - **CSS `[hidden]` 权重被覆盖导致三容器并存挤压**：`reader.css` 中 `.reader-openpageflip-wrap` 与 `.reader-pdf-wrap` 声明了 `display: flex;`，由于缺少 `[hidden]` 最高优先级规则，类选择器特异性覆盖了 HTML 布尔属性 `hidden` 的浏览器默认 `display: none`。导致正文视口 `#reader-viewport` 与两个空容器（`#openpageflip-wrap`、`#pdf-wrap`）在 `#reader-stage` 弹性布局下同屏垂直分摊，在小屏手机上直接将正文视口高度挤压为 0，呈现完全空白！
   - **解决方案**：在 `reader.css` 头部补充最高优先级规则：`[hidden] { display: none !important; }`，并显式为 `.reader-viewport[hidden], .reader-openpageflip-wrap[hidden], .reader-pdf-wrap[hidden]` 声明 `display: none !important;`。
   - **零宽排版崩溃自愈**：在 `updatePaginationMetrics` 中，手机端或切屏过渡瞬间 `viewport.clientWidth` 可能瞬时为 0，原代码将 `content.style.columnWidth` 设为 `0px` 导致多列排版崩溃文字消失。新增 `Math.max(260, rawWidth || fallbackWidth)` 兜底保护，并在 `rawWidth <= 0` 时通过 `requestAnimationFrame` 异步自愈重排。
   - **3D 书卷翻页与书目加载防呆**：修复 `renderOpenPageFlipBook` 中先清空旧实例再解除隐藏的执行时序；在 `loadBook` 中遇到未知或受损书目时自动优雅降级兜底《小王子》全27章典藏版，杜绝任何早期 `return` 留白。
2. 手机端顶部文字（蓝昴空间等）被状态栏/刘海屏遮挡专项治理（`style.css` / `mobile.css` / `reader.css` / `space.css` / `tools/tools.css`）：
   - **首页 Navbar 与 Hero 避让**：在 `style.css` 中为 `.navbar` 原生注入 `padding-top: env(safe-area-inset-top, 0px); box-sizing: border-box;`；为 `.home-simple .hero` 增加顶部空间（`padding: calc(124px + env(safe-area-inset-top, 0px)) 22px 72px;`，小屏 `calc(128px + ...)`），并在 `mobile.css` 注入保障规则，确保「蓝昴空间」主标题从容下移，绝不与手机电量、时钟与刘海重叠。
   - **书架大厅与阅读器顶栏避让**：为 `.shelf-header` 注入 `padding-top: env(safe-area-inset-top, 0px); min-height: calc(56px + env(safe-area-inset-top, 0px));`，为 `.reader-topbar` 注入 `padding-top: env(safe-area-inset-top, 0px); min-height: calc(52px + env(safe-area-inset-top, 0px));`，彻底消除返回链接「‹ 蓝昴空间」和「我的书架」被状态栏遮挡的问题。
   - **阅读舞台避让**：将 `.reader-stage` 题头安全边距升级为 `padding-top: calc(max(28px, env(safe-area-inset-top, 28px)) + 8px);`。
   - **成员空间与工具箱全局贯通**：在 `space.css`（`.space-nav`）与 `tools.css`（`.tools-shell`）中全面补充 `env(safe-area-inset-top, 0px)`，确保全站所有顶栏文字在全面屏/刘海屏/灵动岛机型下零遮挡。
3. 全站 283 项功能与回归测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 移动端顶栏重影与多行堆叠净化：商店、常见问题、头像与备忘录全量适配（2026-11-04 晚）

本节优先于下方历史记录。针对商店页（`store.html`）、常见问题页（`faq.html`）、头像设置页（`profile.html`）与备忘录（`memo.html`）在手机窄屏下，顶部残留多达 5–6 个桌面端导航链接（导致折行堆叠 2–3 行并与底部 `mobile-dock` 形成严重视觉重影与导航冲突）的系统级 Bug 进行专项治理：
1. 桌面端冗余链接移动端自适应屏蔽（`mobile.css`）：
   - 在底栏启用状态下（`.mobile-enabled`），将商店与 FAQ 页的 `.shop-nav-links`、头像设置页的 `.memo-topbar-links` 以及备忘录页多余的直接子链接纳入统一隐藏规则；
   - 彻底释放手机顶部 80px–100px 宝贵的垂直首屏高度，让商店商品、常见问题折叠卡片及头像预览直接进入首屏黄金阅读区。
2. 防死路智能白名单防护：
   - 特别配置 `:not(.memo-topbar-back)` 白名单选择器，严格保留登录认证页（`login.html`）顶部的人机工程学「← 返回首页」返回入口，确保 PWA 与全屏 Webview 环境下导航闭环不出现单向死胡同。
3. 全站 282 项自动化测试、代码安全检查与 clean `dist` 构建 100% 通过。

---

# 在线阅读器：移动端 iOS Safari 16px 防缩放保护与输入控件触控靶心规范（2026-11-04 晚）

本节优先于下方历史记录。针对在线阅读器（`reader.html` / `reader.css` / `tests/reader.test.mjs`）在 iPhone (iOS Safari) 及移动端小屏上，用户聚焦书架搜索、书内全文检索、在线书库搜索或下拉菜单时，因字号小于 16px 触发系统强制放大视口（Page Zoom）导致阅读版面严重变形错位的核心交互 Bug 进行系统性治理：
1. iOS Safari 16px 防自动放大底线规范（`@media (max-width: 820px)`）：
   - 全面覆盖书架书籍搜索框（`.shelf-search-input`，原 13px）、书内正文检索框（`.inbook-search-input`，原 13.5px）、开源在线书库搜索框（`.online-search-input`，原 14px）、自定义网络图书导入框（`.online-url-input`）及伴读声音选择下拉菜单（`.reader-audio-panel select`，原 14px），强制统一升级为标准 `font-size: 16px !important;`；
   - 包含通用保护规则 `.reader-body input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]), .reader-body select, .reader-body textarea`，彻底根除手机端阅读时因点按输入框导致屏幕自动放大、版心失真、双栏/单栏分页坐标偏移的顽疾。
2. 移动端人机工程学触控靶心与包裹层尺寸优化：
   - 为书架搜索外框（`.shelf-search-wrap`）、书内搜索框（`.inbook-search-box`）、在线导入搜索外框（`.online-input-wrap`）以及书籍排序选择器（`.shelf-sort-select`）统一注入 `min-height: 44px; box-sizing: border-box;`；
   - 确保触控操作从容精准，消除手指遮挡与误触。
3. 全站 281 项自动化测试、代码安全检查与 clean `dist` 构建 100% 通过。

---

# 商店详情弹窗：窄屏人机工程学升级、关闭按钮防重叠与全量深色自适应（2026-11-04 晚）

本节优先于下方历史记录。针对商店商品详情弹窗（`dialog#detail` / `store.css` / `tests/store.test.mjs`）在 360px–375px 小屏手机上的严重横向挤压、关闭按钮挤占长标题及夜间白屏眩光进行人机工程与无障碍重构：
1. 窄屏弹窗内边距瘦身与内容可用宽度释放（`@media (max-width: 600px)`）：
   - 将 `dialog#detail` 默认 36px 巨大内边距瘦身至 `padding: 22px 16px 24px`，单侧节省 20px、双侧释放 40px 横向可用空间；
   - 内部各详情模块（`.detail-section`）同步收紧为 `padding: 14px 14px; margin: 14px 0; border-radius: 14px;`，让适用账号、商品说明与质保条款在 iPhone SE、小屏安卓上拥有舒展自然的版心宽度。
2. 关闭按钮脱离文档流与题头防叠防护：
   - 将 `#close` 关闭按钮从原本容易挤占标题布局的浮动流（`float: right`）升级为脱离文档流的绝对定位（`position: absolute; right: 14px; top: 14px;`），并保持 40px×40px 大触控靶心；
   - 题头区（`.detail-header`）配置 `padding-right: 48px;` 专用避让空间，长标题（如包含多规格说明的商品名）彻底告别与关闭按钮的挤压、折行或遮挡。
3. 商品弹窗全链路深色模式双通道闭环（`body[data-theme="dark"]` 与 `@media (prefers-color-scheme: dark)`）：
   - 弹窗底板适配暗夜高级深灰 `#1c1c1e` 与精致微亮边框 `rgba(255, 255, 255, 0.14)`，背板磨砂暗黑微遮罩 `rgba(0, 0, 0, 0.65)`；
   - 关闭按钮适配深灰底色 `#2c2c2e` 与浅白图标，hover 渐变提亮 `#3a3a3c`；
   - 详情分块（`.detail-section`）适配 `#242426` 深灰卡片底与微弱对比边框；
   - 质保专属板块（`.detail-warranty-section`）适配高质感暗夜森林绿 `#17261a` 与翡翠绿聚焦边框 `rgba(52, 199, 89, 0.25)`，质保标题点缀清爽翠绿 `#34c759`，消除夜间刺眼白底。
4. 全站 280 项自动化测试、代码安全检查与 clean `dist` 构建 100% 通过。

---

# 账号安全页：当前登录邮箱明示、发信目标指示、脱敏切换与身份信息安全卡片（2026-11-04 晚）

本节优先于下方历史记录。针对账号安全设置页（`account.html` / `account.js` / `space.css` / `tests/account-security.test.mjs`）缺乏当前登录账户实体信息展示、重置密码发信目标不透明及公共场合隐私泄露风险进行体系化重构：
1. 痛点分析（身份信息暗盒与发信误触疑虑）：
   - 原 `account.html` 验证登录后仅在页首展示一行抽象的「已确认当前登录身份。」，既未展示当前登录账户的邮箱，也未展示用户 UID；
   - 在多账号多邮箱切换、临时公用设备或长期未登录后，用户点击「发送修改密码邮件」时无法确知重置链接究竟发送到了哪个邮箱，产生困惑与误判风险；
   - 若在公共场合（图书馆、咖啡厅、自习室）直接以明文展示完整邮箱，容易泄露个人隐私与注册信息。
2. 身份信息安全卡片（`.account-identity-card`）与专属发信指示：
   - 在主操作区顶部新增「登录身份已确认」安全信息卡片，呈现已验证的账户微徽章与截断 UID（`UID: abc12345…`）；
   - 在卡片内清晰呈现当前绑定的主账号邮箱，并在重置密码操作卡片中增加动态发信目标指示（「向当前账号的注册邮箱（**us***r@example.com**）发送重置链接」），确保发信目标透明可预期。
3. 一键邮箱脱敏与明文切换（`maskEmail` / `updateEmailDisplay`）：
   - 默认采用轻量脱敏算法（如 `user@example.com` 渲染为 `us***r@example.com`，短账号 `ab@domain.com` 渲染为 `a***@domain.com`），兼顾公共环境下的隐私保护与个人确认；
   - 提供 44px 人机工程学快捷切换按钮（`#account-toggle-mask`，👁️ / 🙈），单手一键在脱敏保护与完整明文之间平滑切换，并实时同步「发信提示」与「重置密码预览」中的邮箱文本；
   - 适配标准 `aria-label="显示完整邮箱 / 隐藏邮箱"` 与 `title` 提示，保障屏幕阅读器与无障碍体验。
4. 视觉与双主题无缝自适应：
   - 在 `space.css` 中为 `.account-identity-card` 配置精致微渐变底板与高质感边框；
   - 深度适配深色模式（`body[data-theme="dark"]` 与 `@media (prefers-color-scheme: dark)`），卡片暗色磨砂质感 `#182230`、绿色安全角标 `rgba(52, 199, 89, 0.15)` 与夜间微边框完美融入全站视觉规范。
5. 全站 279 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 登录与认证页：移动端人机工程学升级、返回首页入口与 44px 触控靶心（2026-11-04 晚）

本节优先于下方历史记录。针对登录认证页（`login.html` / `auth.css` / `memo.css` / `mobile.css` / `tests/login-security.test.mjs`）在移动端与小屏上的死路导航与触控误触问题进行人机工程与无障碍重构：
1. 顶栏返回首页防死路由：
   - 将原顶栏不可点击的纯文本 `<span>🐱 Lanmao Space</span><span>登录后进入</span>` 升级为具备清晰指引与返回能力的超链接组合：`<a href="index.html" class="memo-topbar-link">🐱 Lanmao Space</a>` 与 `<a href="index.html" class="memo-topbar-back">← 返回首页</a>`；
   - 彻底解决移动端全屏 PWA、微信 Webview 或独立标签页下，用户进入登录页后无法方便返回首页的单向死胡同痛点。
2. 密码明密文眼睛 44px 人机工程学触控靶心：
   - 将 `.password-toggle-btn` 从原本仅 28px 易误触的小图标重构为标准 44px×44px 触控靶心（`min-width: 44px; min-height: 44px; right: 2px;`），并配套为输入框扩展右侧避让空间 `padding-right: 48px !important;`；
   - 支持 `touch-action: manipulation;` 与 `-webkit-tap-highlight-color: transparent;`，确保单手大拇指轻触即可快速切换明密文，绝不误触后方文本框。
3. 表单切换链接与视口安全区避让：
   - 模式切换按钮 `.auth-links button` 适配 `min-height: 44px; display: inline-flex; align-items: center;`，避免手指粗大时误触相邻链接；
   - `.memo-shell` 窄屏全面引入 `padding-top: calc(72px + env(safe-area-inset-top, 0px))` 与 `padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px))`，彻底消除刘海屏与灵动岛切角遮挡。
4. 全站 276 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 常见问题 FAQ 页与商店：深色模式全量自适应与刘海安全区避让（2026-11-04 晚）

本节优先于下方历史记录。针对常见问题与帮助页（`faq.html` / `faq.css` / `store.css` / `mobile.css` / `tests/store.test.mjs`）在夜间模式下白屏眩光与导航刘海遮挡问题进行专项治理：
1. FAQ 页面全链路深色模式双通道闭环（`body[data-theme="dark"]` 与 `@media (prefers-color-scheme: dark)`）：
   - **Hero 题头区**：光晕自适应为柔和暗蓝径向渐变 `radial-gradient(..., rgba(0, 113, 227, 0.15), transparent)`，副标题文本适配 `#a1a1a6` 舒缓灰；
   - **折叠问答项（`.faq-item`）**：默认浅色白底全面升级为高质感黑曜石微卡片 `#1c1c1e` 与精致微边框 `rgba(255, 255, 255, 0.12)`；展开激活态边框点缀聚焦蓝光 `rgba(41, 151, 255, 0.45)`；
   - **手风琴交互指示（`summary::after`）**：默认折叠状态采用低对比度 `#8e8e93`，展开态高亮电光蓝 `#2997ff`，层级一目了然；正文与粗体要点采用 `#f5f5f7` 与 `#a1a1a6` 清晰对比；
   - **底部咨询联络卡（`.faq-contact-card`）**：适配暗夜深蓝底色 `#182230` 与蓝调边框，咨询按钮 `:hover` 适配亮蓝 `#2997ff`。
2. 商店导航条与页脚全站深色连贯性：
   - 适配 `.shop-nav` 为磨砂半透明黑底 `rgba(22, 22, 26, 0.85)` 与弱白分界线，导航链接与退出登录按钮统一自适应浅白与浅灰；
   - 适配 `.shop-footer` 辅助文案与内链颜色，消除底部文字被深色吞没的问题。
3. 移动端安全区避让：
   - 在 `mobile.css` 移动端启用状态中将 `.shop-nav` 纳入 `padding-top: env(safe-area-inset-top, 0px)`，保障 iPhone 灵动岛/刘海屏与安卓打孔屏置顶时零遮挡。
4. 全站 275 项自动化回归测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 登录与注册页：忘记密码与重发确认邮件 60 秒动态倒计时冷却与本地记忆防刷闭环（2026-11-04 晚）

本节优先于下方历史记录。基于 commit 统一全站认证安全体系，对登录与注册页（`login.html` / `login.js` / `auth.css` / `tests/login-security.test.mjs`）的邮件接口进行 60 秒倒计时防刷与状态闭环：
1. 痛点问题根因（无倒计时置灰与 429 报错风暴）：
   - 原 `login.js` 在处理「忘记密码」表单时，发送请求完毕后在 `finally` 阶段立即恢复按钮（`button.disabled = false`），缺少任何冷却间隔；用户若短时间内再次点击，直接触发 Supabase 后端 `429: For security purposes, you can only request this once every 60 seconds` 限制，弹出「尝试太频繁了，请稍等一会儿再试。」，严重影响体验；
   - 注册后的「重新发送确认邮件」（`resend-confirm`）不仅没有 60 秒冷却，甚至在发送请求期间也没有禁用按钮，导致快速连击时并发发送多次请求，极易触发风控或被邮箱服务商标记为垃圾邮件。
2. 60 秒动态递减倒计时双重冷却系统（`startForgotCooldown` / `startResendCooldown`）：
   - 点击「发送重置邮件」成功后，按钮进入 60 秒倒计时冷却，按钮文案秒级动态递减（`60 秒后可重新发送` ... `0 秒`），同时强制设置 `disabled = true`；
   - 点击「重新发送确认邮件」后，按钮立即在请求期间禁用防止连击，发送成功后同样启动 60 秒倒计时冷却；
   - 在 `auth.css` 中为 `#forgot-button:disabled, #resend-confirm:disabled` 配置统一样式 `cursor: not-allowed; opacity: 0.6;`；
   - 倒计时归零时自动重置为初始文案并解除禁用。
3. 隔离化本地持久化记忆与页面刷新无缝接续（`restoreForgotCooldown` / `restoreResendCooldown`）：
   - 「忘记密码」按输入的邮箱隔离持久化冷却时间戳（`lanmao_auth_forgot_cooldown_<email>`），防止多邮箱相互干扰；
   - 页面刷新、切换不同面板（如登录、注册、找回密码相互切换）或输入邮箱时，自动无缝接续剩余冷却秒数，杜绝通过刷新页面绕过防刷限制；
   - 页面卸载或隐藏（`pagehide`）时，自动安全注销计时器避免内存泄漏。
4. 全站 277 项功能与回归测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 阅读器：书架备份导出突破 2MB 阈值、IndexedDB/内存全量提取与 PDF 二进制 Base64 跨机还原（2026-11-04 晚）

本节优先于下方历史记录。针对微信读书风格伴读器（`reader.html` / `reader.js` / `tests/reader.test.mjs`）书架导出备份中严重的数据截断与丢书隐患进行全链路安全治理：
1. 痛点问题根因（2MB 镜像阈值截断与数据截胡）：
   - `reader.js` 内部设计了 `localStorage` 镜像（仅限 < 2MB）与 `IndexedDB` 大文件持久化主通道；
   - 当用户导入的长篇小说（TXT/EPUB）或累计图书总大小超过 2MB 时，`localStorage.setItem(STORAGE_KEY_CUSTOM_BOOKS)` 自动放弃写入，图书仅安全保存在 `IndexedDB` 与内存 `state.books` 中；
   - 原 `exportBookshelfBackup()` 导出函数竟然直接调用 `localStorage.getItem(STORAGE_KEY_CUSTOM_BOOKS)`，导致**所有大体积图书与超出配额后导入的图书在导出的备份 JSON 中全部缺失**；用户误以为已备份，换机导入时发现心爱图书彻底丢失；
   - 原 `importBookshelfBackup()` 恢复函数在解析时仅按 `Array.isArray(book.chapters)` 过滤，导致 `format: 'pdf'`（非数组章节）格式书目被一票否决全部丢弃；且原代码对 PDF 二进制 `ArrayBuffer` 在 `JSON.stringify` 时直接变成空对象 `{}`，无法跨机导出还原。
2. 全量提取与多级降级安全架构：
   - 升级 `exportBookshelfBackup` 为全异步模式，直连 `IndexedDB` 的 `custom_books` 对象仓库全量读取；
   - 若 `IndexedDB` 未就绪或异常，自动从内存 `state.books` 完整提取所有自定义书籍（`!BUILTIN_BOOKS[b.id]`）；
   - 若内存为空，自动降级至 `localStorage` 镜像；三级保险确保 100% 捕获用户书架上的每一本本地图书。
3. PDF 二进制 ArrayBuffer 与 Base64 跨机序列化闭环：
   - 导出时：针对包含 `pdfData` 二进制 ArrayBuffer 的书目，采用分块高效流式转换为 `pdfDataBase64` 编码字符串保存入 JSON；
   - 导入时：检测到 `pdfDataBase64` 自动解码还原为原生的 `ArrayBuffer`，并兼顾修复非数组章节结构（`chapters = [{ title, page: 1 }]`），再通过 `saveCustomBook(book)` 完整存入本地 IndexedDB 与书架状态中。
4. 全站 273 项功能与回归测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 首页专注钟：移动端轻量化与触控人机工程重构（2026-11-04 晚）

本节优先于下方历史记录。针对移动端与窄屏设备下首页专注钟（`style.css` / `mobile.css` / `tests/focus.test.mjs`）的界面挤压、物理快捷键误导与触控误触问题进行人机工程与响应式重构：
1. 移动端无意义物理快捷键安全隐藏：
   - 在移动端/触摸屏（`@media (max-width: 820px)` 及 `.mobile-enabled` 环境下），为 `.focus-shortcuts-hint` 配置 `display: none !important;`；
   - 彻底隐藏对触屏毫无用处的 `<kbd>Space</kbd> 启停`、`<kbd>R</kbd> 重置`、`<kbd>M</kbd> 提示音`、`<kbd>Z</kbd> 禅定模式` 物理按键提示，释放首屏宝贵的纵向阅读空间。
2. 窄屏统计数据行双列网格自适应与防折行（`@media (max-width: 480px)`）：
   - 将 `.focus-stats-row` 在小屏下从原本拥挤的 `justify-content: space-around` 弹性行升级为双列等宽网格 `grid-template-columns: 1fr 1fr; gap: 12px 8px;`；
   - 隐藏竖向细线分割线 `.focus-stat-divider { display: none; }`；
   - 将字数最长的「保存范围 仅此账号 · 当前浏览器」徽章（`.focus-stat-item:last-child`）设置为跨两列居中展示（`grid-column: span 2`），并带有自适应深色模式的虚线微分割线，彻底根绝 320px–375px 小屏下的文字溢出与尴尬折行。
3. 触控靶心与模式胶囊无缝滚动：
   - 控制按钮 `.focus-btn` 在移动端适配 `min-height: 44px; box-sizing: border-box; touch-action: manipulation;`，完全符合 Apple 与 WCAG 移动端最小 44px 触控靶心人机工程规范；
   - 模式切换栏 `.focus-modes` 在 `<= 600px` 下升级为平滑横向滚动机制（`-webkit-overflow-scrolling: touch; scrollbar-width: none;`），保障在极小宽度机型下胶囊选项完好无损。
4. 全站 273 项功能与回归测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 成员空间：深色模式全量自适应、简介实时字数统计、未保存修改指示与离页守卫（2026-11-04 晚）

本节优先于下方历史记录。基于 commit `1907999` 完成成员空间（`space.html` / `space.js` / `space.css` / `tests/space.test.mjs`）深色护眼配色与表单编辑防护闭环：
1. 痛点根因分析：
   - **深色断层白屏**：移动端底栏菜单切换暗黑外观或跟随系统夜间模式时，`space.css` 因硬编码浅色背景导致卡片与输入框高亮刺眼；
   - **编辑防护与字数盲区**：主页编辑区个人简介缺少字数统计（最大 600 字限制无提示），用户易意外超长；表单输入后无任何“已修改未保存”提示，若用户误触侧边栏、发现成员、底栏或刷新页面，辛辛苦苦写完的简介与链接会毫无警告地丢失。
2. 双通道深色自适应体系（手动切换与系统偏好完整双覆盖）：
   - 支持 `body[data-theme="dark"]` 与 `@media (prefers-color-scheme: dark)` 双重机制；
   - **基础视口与导航**：`body` 适配深邃极夜黑 `#000000` 与柔和文本 `#f5f5f7`，`.space-nav` 适配半透明亚克力磨砂暗底 `rgba(22, 22, 26, 0.85)` 与弱白分界线；
   - **核心卡片与板块**：`.space-card` 统一升格为高级暗灰质感 `#1c1c1e` 与精致低对比微边框 `rgba(255, 255, 255, 0.12)`；动态编辑浮动面板（`#edit-post-form`）适配高质感 `#182230` 与蓝调聚焦线；
   - **表单与交互控件**：输入框、文本域与下拉选择框全量适配 `#2c2c2e` 暗色底、白色输入字体与聚焦主题蓝光环（`:focus-visible`）；常规按钮适配半透明蓝调微背景 `#1c2b3d` 与高辨识度天青蓝文案 `#5ac8fa`；发布主按钮保持高亮饱和蓝底白字；
   - **成员卡片与头像**：发现成员网格项（`.member-grid a`）适配 `#242426` 深灰质感背景与高对比度文字，头像底座统一适配 `#2c2c2e`。
3. 简介实时字数统计与未保存修改状态徽章：
   - 为主页编辑区添加 `<span class="space-counter-badge" id="space-bio-count">0 / 600</span>`，输入时实时计算长度，超过 570 字即触发 `.space-counter-warning` 橙色预警；
   - 提取基础表单状态快照（`snapshotFormState`），输入变更时实时对比基准值；若有修改，在操作按钮旁优雅呈现 `<span class="space-dirty-badge" id="space-dirty-badge">● 有未保存修改</span>`；保存成功或恢复基准时自动隐去。
4. 离页与导航守卫拦截：
   - 监听全站内链点击（`a[href]`）与关键操作（如退出登录按钮），若表单存在未保存脏数据，立即弹出原生确认框「您有尚未保存的个人资料修改，离开本页将丢失修改内容，确定离开吗？」；
   - 挂载 `window.addEventListener('beforeunload')`，拦截刷新与直接关闭窗口。
5. 全站 272 项功能与回归测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 账号安全：重置密码 60 秒动态倒计时冷却、防刷防重复提交与退出所有设备即时反馈（2026-11-04 晚）

本节优先于下方历史记录。基于 33f0a15 完成账号安全页（`account.html` / `account.js` / `auth.css` / `tests/account-security.test.mjs`）邮件防刷防重复提交与状态反馈闭环：
1. 痛点问题根因（无倒计时置灰与状态断层）：
   - 过去用户点击「发送修改密码邮件」成功后，虽然内部记录了 `resetAt` 变量，但在 `finally` 阶段立即解除了按钮禁用（`controls(false)`）；
   - 用户在 60 秒内再次点击仅弹出文案提示「请间隔一分钟再尝试发送。」，按钮外观依然可点击，给用户造成“可以继续点击”或“页面无响应”的严重错觉，极易引发连续重复点击与邮件风暴；
   - 刷新页面后 `resetAt` 变量由于未持久化而丢失；
   - 点击「退出所有设备（包含本机）」并确认后，接口请求期间按钮虽然禁用但无任何即时文字提示，弱网等待期间用户极易焦虑。
2. 60 秒动态递减倒计时冷却体系（`startCooldown` / `stopCooldown`）：
   - 点击发送重置邮件成功后，按钮立即进入 60 秒倒计时冷却状态；
   - 按钮文案秒级动态递减（`60 秒后可重新发送` -> `59 秒` ... -> `0 秒`），期间按钮强制保持 `disabled="true"` 并在 CSS 中配置精致置灰与 `cursor: not-allowed` 禁止光标样式；
   - 倒计时结束瞬间自动重置为初始文案「发送修改密码邮件」并恢复可点击状态；
   - 页面隐藏（`pagehide`）或退出登录时，自动安全清除计时器避免内存泄漏。
3. 按用户隔离的本地冷却记忆与刷新无缝接续（`restoreCooldown`）：
   - 将冷却截止时间戳通过 `lanmao_account_reset_cooldown_<user.id>` 隔离存储于本地存储；
   - 当用户因查看邮件或手滑刷新页面时，页面初始化阶段自动读取剩余秒数并无缝继续倒计时，杜绝通过刷新页面绕过防刷保护。
4. 全渠道退出操作即时状态反馈：
   - 点击「退出所有设备」确认后，立即将状态栏更新为「正在安全退出所有设备，请稍候…」，消除等待空白。
5. 全站 270 项自动化测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 在线阅读器：移动端顶栏防遮挡与目录抽屉全宽自适应重构（2026-11-04 晚）

本节优先于下方历史记录。针对移动端与窄屏设备下在线阅读器（`reader.html` / `reader.css` / `tests/reader.test.mjs`）的严重视觉挤压与遮挡问题进行专项治理与人机工程跃升：
1. 顶部控制栏安全区（Safe-Area）全面避让与防遮挡：
   - 为 `.reader-topbar` 引入 `height: calc(52px + env(safe-area-inset-top, 0px))` 与 `padding: env(safe-area-inset-top, 0px) 16px 0`，彻底解决刘海屏（iPhone X 及后续机型、灵动岛）与打孔安卓机型上顶栏按钮被系统状态栏与摄像头切角遮挡的致命痛点；
   - 底部控制栏（`.reader-bottombar`）同步修复 `calc(12px + env(safe-area-inset-bottom, 0px))` 贴底安全区规范。
2. 顶栏 7 大控制按钮防挤压与移动端精简人机工程：
   - 移动端（`max-width: 600px`）正文沉浸阅读态下自动隐藏本地导入按钮（`#reader-import-btn`，书架大厅已提供完整拖拽与导入入口）；
   - 隐藏顶栏冗长文字徽章（如伴读白噪音“关”、专注钟“25:00”），将控件宽度降低 60%，并精简“返回书架”文本仅保留原生 `‹` 导航指示；
   - 为书名增加 `min-width: 0; flex: 1 1 auto; text-overflow: ellipsis`，确保 320px~414px 各尺寸手机上书名与控制组和谐共存，彻底杜绝爆裂横向溢出。
3. 目录与书签抽屉（`drawer-left`）全宽自适应与分段标签防溢出：
   - 移动端将左侧抽屉由固定的 `320px / 85vw` 升级为与设置抽屉一致的 `100% / 100vw` 沉浸式铺满展开；
   - 将目录、书签、划线笔记、正文搜索 4 大分段切换胶囊（`.drawer-tabs-segment`）升级为自适应横向微动滑块，隐藏冗余字词（如“大纲”），标签触控热区对齐 WCAG 规范；
   - 抽屉关闭按钮（`.drawer-close-btn`）触控热区补齐至 38px/44px 防误触。
4. 全站 270 项自动化测试、代码语法检查与 clean `dist` 构建 100% 通过。

---

# 工具站：空状态一键重置引导、快捷清空与分类数量智能微徽章（2026-11-04 晚）

本节优先于下方历史记录。基于 706f1ad 完成工具站（`tools/index.html` / `tools/tools.js` / `tools/tools.css` / `tests/tools.test.mjs`）搜索无结果死胡同治理与分类感知体验跃升：
1. 痛点问题根因（搜索死胡同与分类感知断层）：
   - 当用户在工具站输入未匹配关键词或在特定分类下搜索无果时，页面仅展示静态文本段落，无任何交互动作引导；用户必须手动选中并按退格键清除搜索框内容，交互极其繁琐；
   - 搜索输入框缺少快捷清空交互（`✕`），移动端与桌面端难以一键重置当前输入；
   - 顶部 5 个分类筛选胶囊（全部、翻译、学术写作、编程开发、设计 & 效率）缺乏工具总量展示，用户无法提前感知各分类下的工具储备规模。
2. 空状态一键重置闭环（`.tools-empty` / `#tools-empty-reset`）：
   - 将原单薄段落升级为现代半透明虚线卡片容器，配以放大搜索图标、友好提示文案与高饱和度「清空搜索并查看全部」操作胶囊；
   - 点击该重置按钮瞬间自动：清空搜索输入框、将当前筛选切回「全部 (15)」、重置全部隐藏卡片与分类标题、重置空状态并自动重新聚焦输入框；
   - 配置流畅淡入渐现微动效（`toolsEmptyFadeIn`）。
3. 搜索框内嵌极速清空按钮（`#tools-search-clear`）：
   - 搜索框内文本非空时右侧即时显现圆形极速清空按钮（`✕`）；用户点击即可一键清空输入并重新触发筛选计算，与键盘 `Esc` 快捷键双重呼应。
4. 动态分类工具数量智能微徽章（`.filter-count`）：
   - 在各分类胶囊按钮内嵌入现代无障碍微徽章（如 `全部 (15)`、`🌐 翻译 (4)`、`📝 学术 (4)`、`💻 编程 (4)`、`🎨 设计 (3)`）；
   - 既在静态 HTML 中预渲染提供首屏零闪烁感知，又在 JS 初始化时依据实际挂载的 DOM 卡片动态统计核对并毫秒级同步；
   - 在激活态（`.active`）与悬浮态下自动反色自适应。
5. 严格遵循 CSP 规范，零内联脚本与零 `innerHTML`，全站 269 项自动化测试通过率 100%。

---

# 学术专注钟：专注与小憩无缝轮转进阶胶囊与一键心流闭环（2026-11-04 晚）

本节优先于下方历史记录。基于 d5ff423 完成学术专注钟（`index.html` / `focus.js` / `style.css` / `tests/focus.test.mjs`）专注与休息阶段无缝衔接与心流闭环：
1. 痛点问题根因（心流断裂体验）：
   - 过去 25 分钟番茄专注倒计时归零后，状态机仅停止并播放提示音，用户必须手动去寻找「5分钟小憩」或「15分钟长休」模式按钮点击切换并再次点击「开始」；
   - 缺乏动态上下文决策引导（每 4 个番茄应触发 15 分钟长休，普通轮次触发 5 分钟短休，休息结束后自动引导进入新一轮 25 分钟专注）；
   - 在全屏沉浸禅定模式（Zen Mode）下，倒计时归零后用户若想继续下一轮，不得不退出全屏甚至频繁点击，打断学术深度沉浸。
2. 动态轮转进阶引导胶囊（`.focus-next-action-wrap` / `.pomodoro-next-wrap`）：
   - 在主卡片倒计时下方及悬浮番茄钟小面板内增设智能进阶胶囊导引载体（`#focus-next-pill-btn` 与 `#pomodoro-next-btn`）；
   - 倒计时进行中或未完成时安全处于 `hidden` 隐藏状态；
   - 倒计时归零停止瞬间，根据当前模式与累计已完成番茄数（`state.completedCount`）动态智能推导下一阶段：
     - 若刚完成第 4、8、12... 个番茄专注：醒目推荐「🌿 太棒了！已达成 4 个番茄，开始 15 分钟长休 ↗」；
     - 若完成常规番茄专注：醒目推荐「☕ 太棒了！专注达成，开始 5 分钟小憩 ↗」；
     - 若休息归零：醒目推荐「🍅 小憩结束，精力充沛！开启新一轮深度专注 ↗」。
3. 极速一键启停与快捷键心流无缝续航（`advanceToNextPhase` / Space）：
   - 点击进阶胶囊按钮直接一键完成「切换目标模式 + 自动启动倒计时 + 解锁并预备音频」完整动作；
   - 深度支持键盘心流快捷键：在倒计时归零（`remainingSeconds === 0 && !isRunning`）状态下，用户只需轻敲键盘「空格键（Space）」，即可直接进阶并无缝开启下一轮倒计时，全程无需脱离键盘与禅定全屏；
   - 配合平滑 CSS 渐现动效（`focusPillFadeIn`）与完善的浅色/深色主题适配。
4. 全站 266 项自动化测试、代码安全规范与打包验证 100% 通过。

---

# 书架在线找书与全局抽屉层级修复（2026-11-04 晚）

本节优先于下方历史记录。解决移动端书架大厅点击「在线找书」无响应与抽屉被隐藏视图遮蔽缺陷（`reader.html` / `reader.css` / `reader.js` / `tests/reader.test.mjs`）：
1. 架构级根因（DOM 视图嵌套陷阱）：
   - 原先全局抽屉（`drawer-toc`、`reader-search-dock`、`drawer-settings`、`drawer-bookshelf`、`drawer-online-search`）全部被嵌套在 `<div class="reader-view-container" id="view-reader" hidden>` 容器内；
   - 当用户处于「我的书架」总览大厅时，`view-reader` 带有 `hidden` 属性（触发 `display: none !important`）；
   - 导致即使 JS 执行 `openDrawer('drawer-online-search')` 移除了抽屉本身的 `hidden` 并唤起遮罩底板，但抽屉的祖先容器仍处于 `display: none`，抽屉在移动端与桌面端书架均无法显示！
2. DOM 视图隔离与抽屉顶层化重构：
   - 将全部通用抽屉（包括目录、设置、书架大纲以及在线开源书库抽屉）全部提升至 `<body>` 直属子节点，与 `#view-bookshelf` 和 `#view-reader` 平级；
   - 使得抽屉显示状态仅由自身的 `hidden` 属性与 `openDrawer()` / `closeDrawer()` 决定，彻底免受双视图切换的层级污染。
3. JS 抽屉回收体系补全：
   - 补齐 `closeDrawer(drawerId)` 导出与调用，消除 `closeDrawer is not defined` 潜在隐患；
   - 在 `closeAllDrawers()` 回收列表数组中补齐 `'drawer-online-search'`，保证点击遮罩底板或外部关闭时 100% 同步关闭。
4. 移动端 CSS 视口变量保底：
   - 在 `:root` 中补齐 `--ui-top: 0px`、`--ui-left: 0px`、`--ui-width: 100vw`、`--ui-height: 100vh` 变量兜底；
   - 修复 `@media (max-width: 820px)` 下 `calc(var(--ui-top) + ...)` 因变量未定义而导致整个属性在计算期失效的 CSS 缺陷；为移动端 600px 以下配置 `width: 100%; max-width: 100vw` 满宽抽屉呈现。
5. 全量 60 项 reader 自动化测试 PASS。

---

# 个人头像设置：未保存修改防丢失拦截与离页守卫（2026-11-04 晚）

本节优先于下方历史记录。基于 63b3c74 为个人头像设置（`profile.html` / `profile.js` / `profile.css` / `tests/avatar.test.mjs`）构建全生命周期未保存修改防丢失防御与视觉反馈体系：
1. 双向基准快照与动态脏状态计算（`captureBaseline` / `checkDirty`）：
   - 页面加载、保存成功或恢复默认后即刻捕获当前头像状态快照（`baselineState`）；
   - 用户点击切换预设 Emoji、点击调色盘渐变色或通过文件框选定 2MB 本地图片时，动态比对当前草稿与基准差异，毫秒级激活脏状态；若用户将 Emoji/配色切回原保存值则自动还原为干净状态。
2. 未保存状态动态指示微徽章（`#avatar-dirty-badge`）：
   - 在「保存头像」与「恢复默认头像」按钮旁增设无障碍微徽章（`.profile-dirty-badge`，`● 有未保存修改`）；
   - 具备琥珀金预警色调与深浅色主题自适应样式，给用户明确的可视化未保存提醒。
3. 全渠道离页拦截与安全防呆（`canLeave` / `beforeunload`）：
   - 捕获 `beforeunload` 事件激活浏览器原生弹窗保护，防止误关标签页或刷新；
   - 在捕获阶段拦截站内 `a[href]` 导航跳转以及顶部 `button[data-signout]` 退出按钮，弹出友好确认框（`当前头像修改尚未保存，确定要离开吗？未保存的内容将会丢失。`）；用户选择取消即刻阻止跳转并保留当前所选图案与图片。
4. 全站 264 项测试、语法安全检查与 clean `dist` 构建 100% 通过。

---

# 加密备忘录：可点击筛选标签胶囊与活跃标签云体系（2026-11-04 晚）

本节优先于下方历史记录。基于 7278b96 完成加密备忘录（`memo.html` / `memo.js` / `memo.css` / `tests/memo.test.mjs`）标签交互与多笔记分类查阅体验跃升：
1. 卡片内可交互标签胶囊（`.memo-tag-pill` / `.memo-card-tags`）：
   - 将原纯静态文本标签（`#t1 · #t2`）全面升级为原生无障碍胶囊按钮（`.memo-tag-pill`）；
   - 点击任意卡片标签胶囊，即可瞬间将其注入顶部搜索框（`#memo-search`）并触发即时分类筛选；
   - 处于激活筛选状态的标签胶囊自动高亮主题蓝背景并同步 `aria-pressed="true"`；再次点击已激活胶囊即可一键反选取消筛选，丝滑还原全部备忘列表。
2. 搜索框下置快捷活跃标签云（`#memo-tag-cloud`）：
   - 动态聚合所有未移入回收站笔记中的有效标签，并计算各标签关联笔记数；
   - 呈现醒目的「全部 (N)」总览胶囊以及按频次降序排列的各个标签筛选胶囊（如 `#工作 (4)`、`#灵感 (2)`）；
   - 回收站视图下自动安全隐藏标签云，避免回收站与活跃笔记标签逻辑混淆；
   - 支持与清除搜索按钮（`#clear-search-button`）联动重置。
3. 严格符合 CSP 与全站现代视觉规范：
   - 零内联事件与 innerHTML，完全基于安全 DOM API（`createElement` / `replaceChildren` / `addEventListener`）；
   - 适配深浅双色主题与高对比度无障碍焦点环（`:focus-visible`）。
4. 全站 263 项功能与回归测试、代码语法检查及 clean `dist` 构建 100% 通过。

---

# 在线阅读器正文全文检索与上下文跳转系统（2026-11-04 晚）

本节优先于下方历史记录。基于 377f3f9 完成在线阅读器（`reader.html` / `reader.js` / `reader.css` / `tests/reader.test.mjs`）正文级全文检索与上下文平滑漫游体系：
1. 双通道检索入口与即时分词防抖扫描（`#reader-btn-search` / `#tab-btn-search`）：
   - 顶栏搜索图标与左侧抽屉第四标签页直达；支持 `Ctrl+F` / `Cmd+F` 快捷键瞬间调出；
   - 160ms 极速防抖全书正文扫描（`searchInBook`），匹配词自动按章节大纲分层聚类展示（`.search-chapter-group`），标注章节名与命中计数；
   - 包含一键清空搜索按钮与空状态友好指引（`kbd` 快捷键展示）。
2. 安全节点级高亮与呼吸脉冲聚焦点（`applySearchHighlights`）：
   - 正文采用 DOM TreeWalker 纯文本节点分段包裹 `<mark class="reader-search-hit">`，完全隔离任何 HTML 脚本注入；
   - 当前正在查看的匹配项自动追加 `.active` 并赋予平滑呼吸脉冲高亮与深浅色模式自适应对比度。
3. 悬浮检索控制台与一键“原位返回”防迷航（`#reader-search-dock`）：
   - 底部滑出轻量级悬浮药丸胶囊控制台，展示当前检索词与序号进度（如 `3 / 15`）；
   - 支持 `▲` / `▼` 按钮与 `F3` / `Shift+F3` / `Enter` 快捷键跨章节自动翻页与上下文居中平滑定位；
   - **核心创新**：一键“返回原位”（`#btn-search-return` / `returnToSearchOrigin`），完美记录检索发起前的精准章节与滚动/翻页坐标，用户查阅完毕后点击一秒回到原阅读进度，彻底解决电子书检索容易迷失当前阅读位置的严重痛点；
   - `Esc` 或关闭按钮即刻无缝销毁会话与正文高亮，零 DOM 脏残留。
4. 全站 262 项测试全部通过（新增 1 项大套系覆盖 25+ 个端点与快捷键契约验证）。

---

# 成员空间动态实时字数统计徽章与临界超限安全防呆（2026-11-04 晚）

本节优先于下方历史记录。基于 2e8a7d6 为成员空间（`space.html` / `space.js` / `space.css` / `tests/space.test.mjs`）提供与首页留言板及备忘录对齐的字数掌控体验：
1. 实时字数徽章反馈（`#post-body-count` / `#edit-post-body-count`）：
   - 在「发布新动态」与「编辑动态」两处表单标签右侧分别增设 `.space-counter-badge`；
   - 具备 `tabular-nums` 等宽排版与 `aria-live="polite"` 无障碍播报；
   - 初始化、动态编辑打开、输入修改、发布成功与取消编辑时全生命周期无缝同步。
2. 双阶梯色彩预警与超限截断防御：
   - 正常状态显示低调中性灰（如 `128 / 2000`）；
   - 达到 1900 字临界阈值时自动泛起橙色预警（`.near-limit`，`#ff9500`）；
   - 超过 2000 字上限时高亮红色警示（`.over-limit`，`#ff3b30`）；
   - 彻底避免用户辛辛苦苦撰写长文提交后因无感知超限导致服务端拒绝或被截断丢字的负面体验。
3. 全站 262 项回归测试全部通过。

---

# 个人空间动态 Markdown 排版工具栏与安全预览（2026-11-04 晚）

本节优先于下方历史记录。在 space.html / space.js 的「发布新动态」和「编辑动态」两个表单中加入轻量 Markdown 辅助：
1. 新增 lib/space-md.mjs：applyFormat 纯函数处理粗体 **、斜体 *、引用 >、行内代码 `、无序列表 -；选中文本时两端包裹并保持选区，未选中时插入示例占位并选中占位文字；引用与列表按行处理，再点一次可取消；越界选区、空值、未知格式、超过 2000 字时稳健返回，不改内容。
2. 预览：编辑 / 预览分段切换，预览用 createElement 与 textContent 构建 DOM，支持段落、换行、引用、无序列表、粗体、斜体、行内代码；未闭合符号原样显示，尖括号和脚本字符只作为文本。空内容给出提示。预览时格式按钮禁用，发布成功、开始编辑、保存、取消后预览自动复位为编辑状态。
3. 已发布动态按同一套 Markdown 安全渲染（.md-rendered）。不使用 innerHTML、eval 或内联脚本，符合现有 CSP；样式用半透明中性色，浅深色主题都能适配，手机上按钮最小 44px。
4. tests/space.test.mjs 新增 14 项（格式化、空内容、特殊字符、选区、预览切换、发布后复位、已发布渲染、CSP 静态检查）。个人空间共 32 项、全站 npm test 261 项与 scripts/check.mjs 通过。

说明：space.js、space.html、space.css、tests/space.test.mjs 里同时有另一进程的实时字数统计徽章（updateTextareaCounter）改动，当时尚未提交，本次提交一并带入，未覆盖。reader.* 的未提交改动不属于本轮，未提交。
边界：测试使用最小 DOM 桩，不是真实浏览器；真实选区光标、手机输入法与读屏仍需实测。未重建 dist，也未做线上核验。

---

# 全站登录/注册/密码重置表单明密文切换与防输错保护（2026-11-04 晚）

本节优先于下方历史记录。基于 0140ede 完成全站身份认证表单（`login.html` / `login.js` / `auth.css`）移动端友好度与防输错体验升级：
1. 密码输入框明密文眼睛切换（Show/Hide Password）：
   - 在登录、注册、注册密码确认、设置新密码、新密码确认全部 5 个密码输入框内增设一体化眼睛微按钮（`.password-toggle-btn`）；
   - 点击即时在 `password`（密文圆点）与 `text`（明文可见）之间平滑切换，图标在 `👁️`（显示密码）与 `🙈`（隐藏密码）间动态流转，并维护对应的 `aria-label`、`title` 与焦点防丢失机制；
   - 彻底解决移动端触屏输入复杂密码（8+ 位、英文字母+数字）容易误触敲错、无法核对字符导致反复报错“密码错误/两次密码不一致”的痛点。
2. 提交与切换面板自动复原与安全防呆（`clearPasswordInputs`）：
   - 提交表单（登录、注册、找回密码、密码重置）或切换认证面板时，双重深度遍历清空所有密码输入框内容；
   - 若用户曾开启明文显示，在清空同时自动将输入框 `type` 强制重置恢复为 `password` 密文遮罩，并将眼睛按钮复原为 `👁️`，杜绝未关闭明文状态残留引发的窥屏泄密隐患。
3. 全站 247 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增密码明密文切换交互与安全复原专项回归测试。

---

# 首页伴读声音音量系统升级：实时百分比、本地记忆与一键静音/还原（2026-11-04 晚）

本节优先于下方历史记录。基于 3050458 完成首页伴读自然白噪音（`ambient.js` / `index.html` / `style.css`）音量控制与心流听觉体验升级：
1. 实时音量数值与动态图标反馈（`#ambient-vol-value` / `#ambient-vol-icon`）：
   - 在主音量滑块右侧增设实时百分比微指示器（如 `40%`、`80%`），具备 `tabular-nums` 等宽字体与 `aria-live="polite"` 友好无障碍播报；
   - 扬声器图标自适应状态流转换：音量为 0 时呈现静音图标 `🔇`，中低音量（<50%）呈现 `🔉`，高音量（≥50%）呈现 `🔊`。
2. 扬声器一键极速静音与恢复（`#ambient-vol-mute`）：
   - 将原纯静态喇叭图标升级为可交互的无障碍微按钮（`.ambient-vol-btn`），悬停带有微比例缩放反馈；
   - 当有声音时点击即刻一键静音归零（`0%`）并记录当前音量记忆；再次点击平滑恢复至静音前的音量水平，彻底满足突发语音通话或切换专注时一键避让的诉求。
3. 本地存储持久化跨会话记忆（`STORAGE_KEY_AMBIENT_VOL = 'lanmao_ambient_vol_v1'`）：
   - 监听滑块与静音切换，自动将用户喜好的音量设置持久化至 `localStorage`；页面刷新、重开或从其他页面返回时，精准还原上次设定的音量，杜绝页面重载后音量突变打扰用户的糟糕体验。
4. 全站 246 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增伴读音量数值反馈、本地记忆与极速静音回归测试。

---

# 工具站全键盘操控（2026-11-04 晚）

本节优先于下方历史记录。为 tools/index.html 与 tools/tools.js 增加键盘效率支持：
1. 数字键 1~9 按筛选按钮顺序切换分类（当前仅 5 个按钮：全部、翻译、学术写作、编程开发、设计 & 效率，所以 1~5 生效，6~9 忽略且不拦截）。切换同步 active 与 aria-pressed，并给目标按钮短暂高亮（.key-flash，prefers-reduced-motion 下关闭），搜索词保持不变。
2. 斜杠 / 聚焦搜索框（搜索框声明 aria-keyshortcuts）；Esc 先清空搜索并恢复列表，搜索框内再按一次退出焦点，失焦后残留搜索词也可被 Esc 清空。
3. 在 input、textarea、select、contenteditable 中打字时不拦截任何数字键或斜杠；带 Ctrl/Meta/Alt 的组合键、输入法组字和已被处理的事件也不触发。
4. 符合 CSP：只用外部 tools.js，无内联脚本、内联事件属性、eval 或 innerHTML。页面新增 .tools-keyhint 提示条，触屏设备（hover: none）自动隐藏。
5. tests/tools.test.mjs 由 3 项增至 15 项，覆盖切换、输入保护、边界数字、Esc 两段行为、修饰键和 CSP 静态检查。npm test 245 项与 scripts/check.mjs 语法检查通过。

边界：测试使用最小 DOM 桩，不是真实浏览器，真实按键、输入法和屏幕阅读器播报仍需浏览器实测。本轮未重新构建 dist（dist 已存在，构建脚本会拒绝覆盖），推送前需另行核对白名单打包；未改动 tools 以外的文件。

---

# 微信读书级书架多视图切换、算法精装封面与在线开源书库（2026-11-04 下午）

本节优先于下方历史记录。基于 474cecb 完成在线阅读器（`reader.html` / `reader.js` / `reader.css`）的书架视觉与图书获取大版本体验飞跃：
1. 三重视图自由排版与多维排序矩阵（`#shelf-view-switcher` / `#shelf-sort-select`）：
   - 网格视图（Grid）：经典三维立体书封网格，清晰直观；
   - 列表视图（List）：横向宽幅列表，展示完整书名、作者、阅读进度百分比与最近阅读时间；
   - 实木层架（Shelf）：微信读书/iBooks 风格实木书架光影（`.view-shelf`），图书置于立体木质隔板之上，极具书香温度；
   - 多维排序矩阵：支持“最近阅读”、“加入时间”、“书名拼音/首字母”、“阅读进度”4 大排序规则，状态均经 `STORAGE_KEY_SHELF_VIEW` 与 `STORAGE_KEY_SHELF_SORT` 本地持久化储存。
2. 莫兰迪 8 大高级色系算法精装书封（Morandi Cover Engine）：
   - 针对无封面或 EPUB 未嵌入封面的书籍，基于书名字符串哈希自适应计算匹配莫兰迪高级质感色系（松柏青绿、黛蓝深邃、朱砂赤红、山吹暖杏、浅驼雅致、雾霾粉紫、暮霭群青、苍石微黛）；
   - 纯 CSS 拟真立体书脊光影（`.card-cover-spine`）与内页切边反光边（`.card-cover-edge`），搭配自适应阅读进度微胶囊（`.card-progress-pill`），大幅提升无封面电子书的视觉档次。
3. 在线开源书库搜索与直链导入（`#drawer-online-search`）：
   - 内置精心挑选的高质量公版典藏（《老人与海》《小王子》《傲慢与偏见》《鲁滨逊漂流记》《科学革命的结构》等）；
   - 支持直连 Open Library 国际公版图书 API 实时搜索并一键拉取；
   - 支持直接输入 EPUB / TXT 远程直链下载导入本地书架；
   - CSP 放行：在 `_headers` 与 `_headers.template` 的 `connect-src` 中严谨授权 `https://openlibrary.org` 与 `https://archive.org`。
4. 全站 233 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增多视图排版、莫兰迪封面与开源书库专项回归测试。

---

# 备忘录长笔记实时字数/字符统计条与一键清空草稿二次确认（2026-11-04 下午）

本节优先于下方历史记录。基于 e9c42f2 完成加密备忘录（`memo.html` / `memo.js` / `memo.css`）正文输入掌控感与防误触安全升级：
1. 实时动态字数与字符统计条（`#memo-body-count`）：在备忘录编辑区内容标签右侧引入微徽章指示器（`0 字 · 0 字符`），采用混合分词算法精准分离中文字符与英文字词，在输入过程中低开销实时更新，彻底满足长笔记、日记与文章创作时的字数掌控感。
2. 一键清空草稿二次确认安全防误触（`#clear-draft-button`）：在保存按钮旁增设清空草稿功能。如果编辑框为空，友好提示“当前编辑框已经是空的”；当编辑框存在内容时，初次点击进入 3.5 秒红色高亮确认态（`#clear-draft-button.confirming`，文案变为“确认清空？”），再次点击才真正清空正文并归零计数，超时自动平滑复原，彻底杜绝手滑误触导致未保存文字丢失的惨剧。
3. 全站 233 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增正文字数/字符统计与二次确认防误触专项回归测试。

---

# 首页联系方式卡片 QQ 号一键快捷复制与防断流降级（2026-11-04 下午）

本节优先于下方历史记录。基于 e53cb77 完成首页联系卡片咨询触达率与无缝降级体验升级：
1. 双通道智能剪贴板复制（`#contact-copy-qq-btn`）：在首页“📬 找到我”联系卡片中，将原有的 QQ 单向跳转链接重构为响应式并排布局（`.contact-item-group`），并增设一键快速复制 QQ 号按钮。优先调用现代浏览器 `navigator.clipboard.writeText` 原生异步 API，并在非安全上下文、WebView 或旧版环境中无缝降级为动态 `textarea` + `document.execCommand('copy')` 方案，确保移动端与微信环境 100% 复制成功率。
2. 防断流视觉与文字反馈（`#contact-qq-feedback`）：按钮点击后即时切换至翠绿色成功态（`.copied`）并将文案动态切换为“已复制”，下方伴随轻量无障碍提示“✨ QQ 号 (3126477562) 已复制到剪贴板！可打开 QQ 搜索添加”，并在 3 秒后自动平滑复原，彻底杜绝微信内置浏览器或手机无 QQ 协议关联导致的联系中断。
3. 测试规范与回归验证：全站 229 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增首页联系方式 QQ 快捷复制专项回归测试。

---

# 首页留言板实时字数计数器与快捷打卡胶囊标签（2026-11-04 下午）

本节优先于下方历史记录。基于 a332e5f 完成首页留言板输入体验与访客互动门槛优化：
1. 实时动态字数统计与临界高亮（`#guestbookCharCount`）：在留言输入框标题栏右侧增设自适应字数指示器（`0 / 2000`）。实时监听输入内容字符长度，并在接近上限（≥1900字）时触发暖橙色告警（`.near-limit`），超限时触发警示红（`.over-limit`），结合输入框原生 `maxlength="2000"` 与 `maxlength="40"` 限制，彻底消除长文输入“盲盒式提交失败”的负面体验。
2. 一键快速打卡问候胶囊（`.guestbook-quick-tags`）：在输入框上方新增友好微胶囊按钮栏（`🐾 前来打卡`、`🌟 收藏小站`、`☕ 催更博主`、`💡 提个建议`），支持一键填充或换行追加打卡预设文本并自动聚焦文本框，极大降低访客表达门槛，显著提升社区互动转化率。
3. 状态闭环与测试规范：留言成功提交并在 `form.reset()` 后自动将计数器归零恢复；全站 228 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增留言板字数计数与打卡标签专项回归测试。

---

# 学术专注钟桌面快捷键与沉浸全屏禅定模式（2026-11-04 下午）

本节优先于下方历史记录。基于 f6b14dc 完成首页学术专注钟桌面端心流体验与沉浸交互升级：
1. 极简沉浸全屏禅定模式（Zen Mode）：在专注卡片控制栏增设“全屏禅定沉浸模式”按钮（`#focus-zen-toggle`）及右上角退出按钮（`#focus-zen-close`）。激活后，卡片通过 `body.focus-zen-active` 平滑全屏展开并锁定背景滚动与手机底栏；大号时钟表盘自适应放大至 300px，配合毛玻璃高斯模糊背景与极简心流视觉，杜绝页面其他元素的干扰。
2. 桌面端全局快捷键与防误触守卫：
   - `Space`（空格键）：一键极速启停/继续当前轮次计时；
   - `R` 键：一键重置当前番茄轮次；
   - `M` 键：一键开启/静音提示音；
   - `Z` 键 / `Esc` 键：快速进入/退出全屏禅定模式。
   - 防误触机制（`isInputActive`）：在输入框（`<input>`、`<textarea>`、`<select>`）或可编辑元素中打字时，绝对不拦截任何原生输入行为。
3. 无障碍焦点恢复与测试规范：记录禅定模式开启触发源（`zenOpener`），在按 Esc 退出时精准将焦点恢复给原按钮；全站 227 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增专注钟快捷键与禅定模式专项回归测试。

---

# 在线阅读器划线书摘卡片一键复制分享与全书 Markdown 导出（2026-11-04 下午）

本节优先于下方历史记录。基于 e001574 完成阅读器划线笔记系统的知识导出与社交分享闭环：
1. 全书 Markdown 结构化导出（`exportHighlightsMarkdown`）：在目录抽屉的“划线笔记”标签页顶部增设统计工具栏（`.highlights-toolbar`）与“📥 导出 Markdown”入口（`#btn-export-highlights`）。支持将当前书籍的所有划线笔记按章节目录自动聚类分段，并注入导出时间、书籍标题、笔记总数与引用金句块（`> “...”`），一键触发标准 UTF-8 Markdown 文件下载，便于无缝导入 Obsidian、Notion 或本地知识库。
2. 单条书摘金句卡片一键快捷复制（`copyHighlightCard`）：为每条划线笔记卡片右侧新增书摘复制操作按钮（`.bookmark-copy-btn`）。采用 `navigator.clipboard` 结合动态 `textarea` 双通道降级机制，支持一键将书摘排版为标准引用格式（`“正文金句” ——《书名》· 章节名（蓝昴空间 · 在线阅读器）`），并附带轻量 Toast 友好反馈，彻底满足读者即时分享金句至微信/朋友圈/小红书的社交诉求。
3. 安全规范与无障碍：延续 DOM 零 `innerHTML` 规范，所有卡片与工具栏元素纯纯由 `createHlEl` 和 `textContent` 安全构造；全站 226 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增全书导出格式与书摘复制回归测试。

---

# 个人空间动态编辑原位高亮与取消焦点恢复（2026-11-04 下午）

本节优先于下方历史记录。基于 692ea73 完成个人空间动态编辑的视线锚定与无障碍交互优化：
1. 动态卡片原位高亮锚定（`.space-post-editing`）：当用户点击某条动态的“编辑动态”时，该动态卡片即刻包裹优雅高亮外框并呈现“正在编辑此条”专属勋章；同时编辑表单自动平滑滚动聚焦（`scrollIntoView`），彻底杜绝在长动态列表中点击编辑因表单位于列表上方导致的“不知道改的是哪条”与视线迷失缺陷。
2. 精准无障碍焦点回跳（WCAG AA）：精准记忆发起编辑的触发源按钮引用（`editOpener`）。当用户点击“取消编辑”或成功保存后，自动清除原位高亮标记，并无损恢复键盘与无障碍读屏焦点至最初的“编辑动态”按钮，形成完整闭环。
3. 全站 225 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增滚动定位、卡片高亮与焦点恢复专项回归测试。

---

# 商店弹窗遮罩关闭与阅读器触控状态机发布（2026-11-04 晚）

本节优先于下方历史记录。本轮完成并已上线三项：
1. 商店商品详情弹窗支持点击遮罩底板关闭，关闭后焦点回到原触发按钮；新增「一键复制 QQ」按钮与友好提示（提交 f52ad04）。
2. 阅读器移动端触控状态机拆分为独立模块 reader-gesture.js（纯状态机 GestureMachine + DOM 适配层 attach，含 8 项单测），reader.js 改为接线，解决长按选区误触发滑页、拖动滑块/气泡菜单误翻页的真机冲突（提交 f0e8051）。
3. 个人空间编辑动态：当前编辑卡片高亮、切换时表单平滑滚入、保存/取消后焦点回到原「编辑动态」按钮（提交 692ea73）。
`npm test` 225 项、scripts/check.mjs 语法检查与 clean dist 全部通过；已推送 main（远程 692ea73）并运行 verify-live.mjs 得到 PASS。触控状态机的真实选区、放大镜与手机长按仍属真机待验，Node 单测使用最小 DOM 桩。
---

# 商店详情弹窗遮罩点击关闭与快捷复制 QQ 号（2026-11-04 下午）

本节优先于下方历史记录。基于 f52ad04 完成商店详情弹窗交互与客服咨询转化优化：
1. 详情弹窗遮罩（::backdrop）点击关闭与原位焦点恢复：为 `<dialog id="detail">` 增加智能外沿点击判定，在移动端与桌面端实现点击弹窗卡片外部遮罩即平滑关闭，并精准将无障碍焦点归还给触发卡片的按钮，消除移动端用户必须精准点按右上角微小“×”关闭按钮的交互死角。
2. 快捷一键复制 QQ 号与优雅降级反馈（`#copy-qq-btn`）：在弹窗底部新增“复制 QQ 号 (3126477562)”按钮与响应式栅格布局，采用 `navigator.clipboard` 结合原生 `textarea` 双通道降级保证 100% 复制成功率；提供按钮自身微动效与提示文本动态切换，彻底解决微信内置浏览器或手机无 QQ 协议关联导致的咨询断流问题。
3. 全站 224 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增遮罩点击判定与剪贴板复制专项回归测试。

---

# 备忘录离线暂存指示与弱网自动重连同步（2026-11-04 下午）

本节优先于下方历史记录。基于 0b38e12 与 a396cba 完成备忘录离线状态指示与弱网重连体验增强：
1. 离线暂存模式视觉胶囊指示（`#memo-network-badge`）：在备忘录工作区顶栏引入自适应网络胶囊。当网络断开时，动态展示暖琥珀色指示条及脉动光标，明确提示用户“离线暂存模式：网络连接已断开，修改将保留在当前标签页”，并在离线操作失败时友好安抚，消除数据丢失恐惧与疑虑。
2. 弱网自动重连与草稿保护同步：监听 `window.online` 与 `window.offline` 事件。网络恢复时动态点亮青翠绿色指示，在无未保存草稿时自动触发静默 `reload()` 同步云端数据并于 3.5s 后平滑隐藏；若检测到正在编辑未提交的草稿，坚决不进行静默覆写，而是礼貌引导用户点击“保存并同步”，保障本地草稿绝对安全。
3. 全站 207 项功能测试、语法安全检查与 clean `dist` 构建全部通过。新增离线事件与自动同步专项回归测试。

---

# 阅读器正文划线笔记（2026-11-04 下午）

本节优先于下方历史记录。新增 reader-highlight.js（独立模块，用 TextQuote 加位置提示锚定，只存原文与前后文，不存页码或 DOM 偏移，字号和排版变化不影响还原），并接入阅读器：
1. 顶栏 ✎ 开启划线模式，选中正文后点浮动「划线」按钮保存。目录抽屉新增第三个标签页「划线笔记」，点击条目跳到所在章节与页并闪烁。划线模式下触控热区让出点击并暂停滑动翻页（热区原本盖在正文上方且禁止选中），退出模式后恢复翻页。
2. 存储键 lanmao_reader_highlights_v1，每本书最多 500 条，单条最多 2000 字；存储写入失败时回滚并提示。书架备份新增 highlights 字段，导入按划线 id 去重合并。笔记列表用 textContent 构建，不拼 innerHTML。
3. 仅文字书籍的滑动与滚动模式支持；PDF 和 3D 翻书（curl）模式不渲染这套正文 DOM，不支持划线。reader-highlight.js 已加入 scripts/build.mjs 白名单。
4. 207 项功能测试、语法检查与 clean dist 构建通过；reader.test.mjs 新增接入回归测试。

边界：划线算法测试使用最小 DOM 桩，不是真实浏览器。真实选区、手机长按选字、系统选择菜单与浮动按钮是否重叠、分页模式跳转到正确页码，都仍需在浏览器和真机上实测。已在本地提交为 a396cba（未确认是否已推送与上线）。

---

# 专注钟标题语义保护与移动底栏相交滚动联动（2026-11-04 下午）

本节优先于下方历史记录。基于 fa0205b 完成两项关键体验与 SEO 语义优化：
1. 专注钟标题语义与 SEO 标语保护：重构 `focus.js` 页面标题生命周期，动态捕获页面原始 `document.title`。在深度专注进行时动态呈现倒计时（如 `(24:59) 蓝昴空间 · 专注中`），在暂停、重置或登出时精准恢复原始品牌及 SEO 标语，彻底杜绝原有硬编码固定值覆盖全站标题缺陷。
2. 移动端底栏滚动自适应高亮（IntersectionObserver）：升级 `mobile-nav.js`，引入视口相交监听器。当用户在首页自由滑动浏览经过 `#focus` 专注钟模块时，底部 Dock 栏自适应切换至“◷ 专注”高亮；划离后无缝回退至主页锚点，消除静态 URL 模式下的底栏状态脱节。
3. 全站 196 项功能测试、语法检查与 clean `dist` 构建通过。新增专项回归测试。

---

# 书架移动端个人空间通道互联与焦点回跳优化（2026-11-04 下午）

本节优先于下方历史记录。基于 a2876a0 完成两项体验与无障碍优化：
1. 书架底栏直达个人空间通道：在书架吸底导航栏工具区新增“♙ 空间”直达链接（`#shelf-btn-space`），使移动端阅读器用户可一键直达个人主页、动态发布与账号安全，打破书架与全站用户体系的跳转孤岛；针对 <= 380px 极窄屏幕配置精细响应式样式，保障 4 颗紧凑圆形图标按钮平滑排布不换行不溢出。
2. 抽屉关闭焦点精准回跳（WCAG AA）：在 `openDrawer` 中精准捕获触发源元素 `lastDrawerTrigger`，并在 `closeAllDrawers` 时无损恢复焦点，彻底消除键盘导航与无障碍读屏时的焦点丢失问题。
3. 全站 195 项功能测试、语法检查与 clean `dist` 构建通过。新增专项回归测试。

---

# 大文件导入反馈与 PDF 排版防呆优化（2026-11-04 下午）

本节优先于下方历史记录。基于 9d14a1b 完成两项关键体验与防呆优化：
1. 本地大文件导入 Loading 遮罩与防重点击：在书架 `#shelf-drop-zone` 与抽屉 `#drop-zone` 引入 `.import-loading-overlay` 毛玻璃遮罩动画与 `setImportingState` 状态管理。文件导入过程中动态禁用文件输入控件并展示“正在载入《...》，请稍候…”提示，彻底消除大文件（大 TXT/PDF）解码解析期间主线程耗时造成的“未点中”错觉与频繁重复点击。
2. PDF 模式排版防呆指示条与置灰反馈：排版设置抽屉顶部新增 `#pdf-settings-notice` 专属蓝色提示卡片，明确告知用户 PDF 为固定版面画册；在 PDF 阅读模式下，自动置灰不可用的字号缩放、字体切换与翻页动效四宫格，点击时给出友好气泡指引，避免用户困惑。
3. 全站 192 项功能测试、语法检查与构建通过。新增专项回归测试。

---

# PDF 刷新异步竞态修复与构建验证（2026-11-04 下午）

本节优先于下方历史记录。基于 0858f18 完成核心缺陷修复与构建校验：
1. PDF 刷新路由异步竞态防死锁：解决本地导入 PDF 后，浏览器刷新带参数网址（`reader.html?book=custom_pdf_...`）因 localStorage 仅存元数据、IndexedDB 尚未完成异步读取导致误报“未能读取到本地 PDF 二进制数据”且回调短路无法恢复的死锁缺陷。在 `state` 增加 `dbLoaded` 状态守卫；在 `renderPdfBook` 中增加平滑加载提示；在 `initCustomBooksStorage` 异步回调中增加 `targetBook.format === 'pdf' && !state.pdfFlipInstance` 判断，数据到达后无缝挂载 3D 翻页实例。
2. 构建与运行验证：191 项功能测试、语法检查以及 clean `dist` 构建全部通过。新增专项回归测试用例。

---

# 移动端性能加速与书架底栏视觉重构（2026-11-04 午）

本节优先于下方历史记录。基于 5aa0e28 完成三项关键体验与性能优化：
1. 个人空间（我的）秒开加速：优化 space.js 数据加载瀑布流，优先从本地会话与快照缓存读取主页数据实现首屏 0 秒直出；将主页资料与动态改为 Promise.all 并行加载，次要列表（成员、用量、屏蔽、举报）移至后置异步并发，彻底消除移动端多轮串行网络延迟导致的长时间“正在加载”空白；并在 mobile-nav.js 中增加 space.html 的空闲预加载（prefetch）。
2. 书架移动端吸底栏视觉重构：彻底解决全面屏底部安全区（Home Indicator）挤压导致的垂直与水平溢出问题。采用弹性高度 min-height: 52px 与 calc(8px + env(safe-area-inset-bottom)) 安全区避让；右侧工具按钮在移动端切换为无文字徽标的紧凑圆形图标按钮，为左侧预留充足呼吸空间，彻底杜绝“蓝昴空间”与“我的书架”被挤压换行或溢出。
3. 移除书架表情符号：按反馈在 reader.html 中删除“我的书架”标题旁的 📚 表情符号，使移动端底栏更显纯净轻盈。
全站 189 项功能测试、语法检查与构建通过。

---

# Claude 剩余改动发布（2026-11-04）

本节优先于历史记录。阅读器补齐与其他页面相同的前端登录守卫，login.js 允许登录后返回 /reader 与 /reader.html 并保留原查询参数/锚点。守卫仍为静态站软门禁，不能称作服务端鉴权。reader.js 仅修正 EPUB 支持范围的注释，不改阅读数据或逻辑。

npm test 与 scripts/check.mjs 共用 scripts/test-list.mjs；新增 scripts/test.mjs，187 项功能测试和语法、dist 构建通过。AUDIT.md 已作为历史报告加入，并在顶部注明已修复事项。首页三步上手、书架备份提醒和格式配置已在远程，无需重复覆盖；SQL 文件仅本地行尾差异，线上数据库不需要执行新脚本。

发布以 facf3b8 为基线，保留此前蓝色 UI 更新。真实账号登录/邮件、加密备忘录和安卓真机流程仍需相应实际验收。本轮未读取私人内容。

---

# 内容完善与仓库整理（2026-11-04）

本节优先于下方历史记录。首页 hero 区新增“三步上手”引导句（阅读器→自然声→专注钟）；阅读器导入区补充“换浏览器或清除站点数据前先导出书架备份”的提醒；README 修正为“本地预览无需构建，部署时执行 node scripts/build.mjs”。新增 .gitattributes（LF 统一）与 .editorconfig，不重写现有文件行尾。审查报告中“npm test 漏测”已过时：npm test 与 check.mjs 共用 scripts/test-list.mjs；reader.js 头部注释也已说明 EPUB 暂不支持。未改 reader.js 逻辑、数据库、价格、配色，隐藏模块保持隐藏。scripts/check.mjs 187 项功能测试通过；未做真机或线上验收。

---

# 蓝色视觉样式发布（2026-11-04）

本节优先于下方历史记录。本轮发布本地尚未上线的 8 个 CSS 文件（style、motion、reader、memo、profile、space、store、faq）：统一蓝色渐变/光晕、深色模式及提示区域配色，修正缺失的灰色变量和阅读器次要文字变量。保留当前首页内容与隐藏功能范围。

基于远程 a225b16 制作隔离副本，未混入本地登录、reader.html 守卫、数据库、测试入口等其他未完成修改；不要通过 reset/覆盖文件清理这些本地改动。本轮 185 项功能测试、语法检查和 dist 构建通过；桌面明暗主题与 320px 手机搜索弹窗已核验，未做安卓真机测试。

---

# 阅读器审查缺陷修复（2026-11-03 晚）

本节优先于下方历史记录。基于 102f523 修复审查报告中 reader.js 的 4 项核心缺陷：
1. IndexedDB 事务生命周期：以 tx.oncomplete 确认提交，tx.onabort / tx.onerror 统一失败降级，增加单次执行守卫，解决事务中止后仍提前报成功问题。
2. Android 原生音量键翻页桥梁：修正为 state.activeView 校验，并在 dialog 或抽屉处于 open 状态时阻止翻页防误触。
3. 超大书籍刷新路由恢复：初始加载前在闭包捕获目标书籍及章节/页码参数，IndexedDB 异步加载完成回调中优先使用捕获目标，不依赖被改写的 URL。
4. 书架卡片删除按钮键盘无障碍：网格 keydown 过滤 .card-delete-btn 和子按钮，避免焦点在删除按钮按 Enter/Space 拦截事件误打开书籍。
本轮 185 项全套回归测试与语法检查全部通过。

---

# 手机弹窗与控件修复（2026-11-03）

本节优先于下方历史记录。基于远程 2fea337（含最新阅读器更新）修复：首页搜索的定位 transform 曾被 motion.css 入场动画覆盖，320px 窄屏会向右越界。弹窗动画现在仅改变透明度；搜索新增关闭按钮、长标题换行、结果区域独立滚动及关闭后的焦点返回，手机不再显示仅适用于键盘的提示。

lib/viewport.mjs 共享可见视口尺寸与偏移，适配软键盘、横屏和安全区；手机更多菜单、共用弹窗、阅读声音面板及阅读设置抽屉按可见区域收缩。lib/theme.mjs 同步根节点与正文的主题，解决手机切换后文字/背景颜色不一致。常用计时与关闭控件最小点击高度 44px。

本轮 181 项 Node 功能测试及语法检查通过。浏览器已核验 320×320、320×568 的搜索完整边界与结果滚动、640×360 横屏阅读设置滚动，以及阅读声音面板的边界和主题。软键盘尺寸/偏移由隔离测试模拟，不等于安卓真机验收；实际输入法、系统大字体和手势导航仍需真机反馈。未改 reader.js、数据库或私人内容；本地 reader.js 草稿必须保留。首页隐藏功能继续保持隐藏。

---

# 当前首页与功能展示（2026-11-03）

本节优先于下方旧记录。首页主线为阅读器、自然声音、专注钟，保留留言；个人功能集中于“我的”。手机底栏为：首页、阅读、专注、我的、更多。商店及其 FAQ、音乐影视、工具导航/工具站、阅读书单、友情链接暂时隐藏。书单/歌曲/工具演示统计同时隐藏。

隐藏采用静态 HTML hidden（共用 CSS 强制遵守），并同步移除全局搜索、手机菜单、页脚和其他页面导航中的相关入口。原内容仍在仓库；store.html / tools/ / faq.html 通过原网址仍能访问，隐藏不代表访问控制，不更改登录/RLS/价格/接单方式。相关独立页标记 noindex 并从 sitemap 撤下，不承诺搜索引擎立即移除旧结果。将来只有店主明确要求才恢复，恢复时要同时核对入口、搜索、手机底栏、HTML hidden、robots 与 sitemap。

本轮已核验桌面与手机导航、搜索排除暂停模块、个人菜单 Esc 收起，以及 320/390/768/1100 宽度无横向溢出。首页 script.js 使用 defer，在搜索弹窗解析完成后再初始化。147 项功能检查通过；不把本次界面核验称为 Android 真机验收。

此次基于 c514f92 的最新阅读器/书架更新，不修改其阅读、导入或翻页实现。正式站仍为 https://lanmaospace.pages.dev/，常规测试通过后直接推送授权继续有效。

---
# 当前权威状态（2026-11-02）

本节优先于下方历史记录。正式站已迁移到 https://lanmaospace.pages.dev/；Cloudflare main 自动部署，构建 node scripts/build.mjs，输出 dist。Netlify 仅保留旧站，不再是正式站。

截至本轮，48 项功能测试通过（22 备忘录、3 审核界面、4 商品、5 商店交互、7 头像、3 工具筛选、4 登录回跳），38 项数据库权限检查已在本环境重新执行并通过。功能与上线状态以远程 main 和实际资源为准。商店数据在 products.json。头像、站内审核、分类直达均已实现；真实账号邮件/备份/头像保存及完整手机键盘验收仍未完成。备份提醒不是自动备份。工具目录只在 tools/ 维护，首页是分类入口。

后续任务见 TASKS.md；可复制交接文本见 NEXT-AGENT-PROMPT.md。下方保留历史过程用于追溯，旧的“Netlify 暂停所以新功能未上线”等描述不代表现在状态。

---
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

原生 HTML / CSS / JavaScript 静态站，没有 React 或 npm 构建；登录、备忘录和留言使用 Supabase。

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
- 留言板已接 Supabase（2026-11-01 已发布）：留言存 `guestbook_messages` 表，需店主在后台把 `approved` 改成 true 才会公开显示；此前只插页面、刷新丢失的假提交逻辑和写死的示例留言已删除。
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

本次修复基于远程 `84bcec8`；最新提交及部署状态需在继续工作前重新核验。

完成修改后检查差异，只提交相关文件。不要无条件覆盖、强制推送或重置用户修改。确认要上线时推送 main；推送成功不等于部署成功，继续确认 Netlify 发布和正式网址资源。

GitHub 仓库公开，可直接克隆；推送需要有写权限的 GitHub 账号。Netlify 后台操作需要站点所属账号。不要要求用户在聊天里发送密码或令牌。

## 留言板权限修复与附件删除（2026-11-01）

- 店主反馈权限修复 SQL 执行成功，并验证访客提交 → 待审核不显示 → 店主审核后显示流程。此为店主反馈，agent 未登录后台独立核验。脚本与操作说明见 `supabase/GUESTBOOK-SECURITY.md`。
- 附件删除先查询完整元数据，查询或文件删除失败时停止；区分记录删除未确认与删除后刷新失败，阻止重复删除请求。7 项模拟成功/故障测试通过，未操作真实备忘录。Storage 和数据库仍非原子事务，跨设备同时上传/删除仍需后续服务端协调。
- 此节随修复代码提交；是否部署完成以正式站实际资源为准，不能只看推送结果。

## 最新发布授权（2026-11-01，覆盖早先逐次确认要求）

用户授权：每次更新前核验通过即可直接上线，不再逐次请求确认。仍须先 fetch、核对远程 HEAD 与本地差异，完成相应测试；只提交相关文件，不 force-push、不覆盖他人改动。推送后必须核验正式站。价格、接单方式、部署设置与预览权限的修改仍需用户明确要求。
当前环境没有原 snapshot-push 命令时，可用 GitHub 连接器创建基于已核对 HEAD 的单个提交，再通过 expected_sha 检查快进更新 main；不得省略远程确认。


## 备忘录完整升级（2026-11-01）

本次升级包含未保存提醒、基于密文版本的条件更新、完整加密备份/校验/副本恢复、10 分钟空闲锁定及加密草稿暂存、附件进度/重试/图片预览、加密标签/置顶/回收站。新增 `memo-core.mjs`、`MEMO-GUIDE.md`、`tests/memo.test.mjs` 和 `tests/permissions.test.mjs`；没有新增网站运行依赖或修改部署设置。旧加密条目兼容；上线后刷新旧标签页。限制与验证见 MEMO-GUIDE.md。

店主 2026-11-01 已反馈执行 `supabase/memo-owner-security.sql`。本地 18 项功能测试、24 项 PostgreSQL 权限测试通过；线上真实账号尚待验证。

部署阻碍已查明：店主提供 Netlify 横幅，团队只剩 operational credits，已发布站点仍在线，但 production deploys 被暂停。需等待计费周期额度恢复或由店主决定升级后再部署。不能将 GitHub 推送成功当成正式站已更新，也不要擅自购买套餐或改部署项目。

注册排查：2026-11-01 只读 `/auth/v1/settings` 返回 `disable_signup=true`、`mailer_autoconfirm=true`、Email 提供商开启；朋友注册失败与注册关闭相符。已指导店主开启 Allow new users to sign up；此处未记录任何密钥或邮箱。后续应重新读取开关，不能根据旧交接声称已开放。


## 后续只读复核（2026-11-01）

注册已由店主开放，随后两次只读 Auth settings 确认 `disable_signup=false`、`mailer_autoconfirm=false`、Email 提供商开启。即允许注册但需要邮箱确认；邮件是否成功送达朋友还未实测。不要关闭邮箱确认来掩盖邮件问题。

截至本轮复核，正式站 memo.html / memo.js 没有升级标记，memo-core.mjs 返回 404。Netlify 额度暂停部署问题仍未解决；升级代码已在 GitHub，不能报成已上线。新增 `node scripts/verify-live.mjs`：只检查公开页面与脚本，逐项报告状态，资源匹配时退出 0，尚未部署或请求失败时退出 2，不输出任何密钥。

同时将基础 `supabase/memo-files.sql` 的桶上限统一为 20971536 字节，防止重跑基础脚本后重新出现“正好 20 MB 原文件加密后超过上限”的问题。店主已执行的 memo-owner-security.sql 已包含相同修复，无需为此再次执行 SQL。

## 保存与草稿可靠性复审（2026-11-01）

- 新建操作使用固定 UUID 和密文，在响应丢失时核对该 ID；连核对都断网时保留尝试，恢复网络后重试不重复建行。失败期间继续编辑的内容会基于确认行进行条件更新；另存副本才明确使用新 ID。
- 解锁后列表同步失败也会恢复本标签页加密草稿，保留其未确认的新建编号。尚未恢复的加密草稿不会被再次空闲锁定清除；跨标签退出时仍检查会话代次。
- 新增 4 项回归测试，总计 22 项备忘录功能测试通过。此改动无需新增 SQL；正式站仍受 Netlify 生产部署额度暂停影响，须运行 scripts/verify-live.mjs 验收，不可误报已上线。
## Cloudflare Pages 迁移（2026-11-01，进行中）

用户授权部署到 Cloudflare Pages 免费版，GitHub main 自动部署，项目名 lanmaospace。原 Netlify 项目保留，不更改其权限或套餐。Cloudflare 首次部署由店主在后台发起；正式新网址与验证结果待完成后补记。迁移需要在 Supabase Auth URL Configuration 添加新站点的登录回跳地址，保留旧站点地址，不能仅以首页 200 判断登录流程可用。

同步远程 44fe6bb 后修复 login.js 注册提示中的字符串引号语法错误，并适配备忘录测试的共享模块导入与 ownerUid 配置；22 项备忘录测试及 JavaScript 语法检查通过。

### Cloudflare 发布验证

新正式地址：https://lanmaospace.pages.dev/ 。Cloudflare production 已自动发布 2063389（登录引号修复），未登录访问首页已验证跳转 /login?next=%2F，登录页正常渲染。README、sitemap、robots 和 verify-live 默认目标同步到新地址。旧 Netlify 地址保留，但旧版本因额度暂停不更新。

Supabase 新域名 Site URL / Redirect URLs 已通知店主配置，店主回复“好的”，尚不能认定已执行；必须等明确完成反馈，并实测邮件确认/密码重置回跳。未代用户输入密码、解锁真实备忘录或发送测试邮件。历史章节中的 Netlify 信息仅供追溯，以本节为准。

## 发布检查与站内审核（2026-11-01）

- 店主已明确反馈完成 Supabase 新域名 Site URL / Redirect URLs 配置；邮件确认和重置密码尚未实测。
- Cloudflare 构建命令改为 `node scripts/build.mjs`，产物目录 `dist`。先扫描 JS 语法、商品 JSON 并运行 22 项备忘录和 3 项审核界面回归测试，失败则停止，不替换旧生产版本。build 只打包运行文件，不发布 SQL、测试和交接文档；本地已有 dist 时先移走旧产物后重建。
- `guestbook-admin.js` 在首页为店主显示待审核/已公开列表、分页、审核通过及撤回公开按钮；访客不显示入口。数据库通过 `supabase/guestbook-owner-review.sql` 的两个 RPC 独立校验店主 UID，普通用户不能调用，不开放邮箱列或直接 UPDATE。审核使用预期状态防止过期操作；撤回不是永久删除。
- 店主已反馈执行 guestbook-owner-review.sql，线上实际审核待店主登录验证。SQL 在本地 PGlite 测试通过，权限测试由 24 项扩展为 38 项；没有操作真实留言。
- `npm test` 修复为可独立运行的备忘录测试；`npm run test:db` 为需安装 PGlite 或设置 PGLITE_MODULE 的数据库测试，不在无依赖的云端构建中运行。
- 后续：真实邮件流程和私人备份需店主实测；占位数字/友链、商品库存/交付时效等无真实资料不能编造。自动检查与留言审核先优先发布，其他项目逐步完善。

## 备份操作提示与手机布局（2026-11-02）

备忘录解锁后显示每周/重要修改后导出提醒，明确不会自动替用户保存备份；备份面板提示导出后选回文件做只读完整性校验。未读取真实备忘录或记录口令。手机端输入字号 16px、按钮最小高度 44px、导航换行、长商品弹窗可滚动；商品图异步解码，不改图片内容、价格或供货说明。

## 商店维护字段（2026-11-02）

商品数据源为 products.json（历史“只在 store.js”描述已过时）。新增可选 availability / priceUpdatedAt / deliveryNote，缺省仅提示咨询，不编造库存、更新时间或交付承诺；本次 products.json、价格和 QQ 均未修改。加载失败显示明确错误和重试按钮，15 秒超时。lib/catalog.mjs 统一数据校验，发布检查新增商品结构/日期/图片检查。操作说明见 STORE-GUIDE.md。

## 工具入口精简（2026-11-02）

首页不再维护与工具站重复的 12 张外部工具卡片，改为翻译、学术、开发、设计效率四个任务入口，直达 tools/?category=...。顶部导航只保留“工具站”；#toolbox 锚点继续可用。完整 15 个工具及搜索仍在工具站，合法 category 参数预选分类，未知参数回退全部。新增 3 项分类直达/搜索组合回归测试。本地现有功能测试 41 项，本次后为 44 项。38 项数据库权限检查已在本环境重新通过；SQL 未改。真实账号与手机完整验收仍待实测。

## 头像页登录回跳和移动操作（2026-11-02）

修复 login.js safeNext 白名单缺少 /profile、/profile.html 的问题，避免未登录访问头像页后丢失原目标。新增 4 项回跳测试，覆盖头像页、工具分类参数保留、跨站地址拒绝、未知路径回退，总计 48 项功能测试。头像页和商店导航增加小屏换行，头像页操作、工具分类及导航补 44px 点击高度；工具搜索和首页留言表单手机字号 16px。此为代码与本地模拟/HTTP验证，完整真实手机矩阵与真实登录仍待实测。

## 隔离自动检查（2026-11-02）

新增 .github/workflows/checks.yml：main 推送和 PR 自动运行 48 项功能测试及 56 项 PostgreSQL 权限检查，随后验证 dist 打包。固定官方 checkout/setup-node 提交，只有 contents:read，不保存 Git 凭据，不使用任何 Supabase 密钥或连接生产库。PGlite 0.5.14 只装到 runner 临时目录，不增加网站运行依赖，也不进入 dist。

新增头像数据库测试验证 profiles 自己可读写、跨用户修改拒绝、avatars 存储路径写权限、公开留言函数仅返回已通过留言且无邮箱/user_id 列、头像桶限额/类型配置和 SQL 可重复执行。注意：内存 SQL 测试不模拟 Storage HTTP 文件大小/MIME 网关校验，也不能代替真实用户上传测试。GitHub 检查与 Cloudflare 自动部署并行；数据库检查失败会报告，但当前不会单独阻止 Cloudflare 发布，生产构建继续依赖功能测试门槛。

## FAQ、质保与缓存修复（2026-11-03）

基于 d52b744 修复审核发现的五项问题：FAQ HTML/CSS 纳入 dist 与线上验收；登录回跳放行 /faq 和 /faq.html；商品测试改用独立缺省样例以适配新增质保字段，补充质保字段校验与缺省/无质保说明回归；缺少 warranty 时不再显示 undefined 或自动生成退款承诺；未版本化资源统一 no-cache 重新验证，memo-config.js 单独 no-store，移除冲突的一年 immutable 规则（_headers 和旧 netlify.toml 对齐）。FAQ 未确认的付款方式、交付时限、在线时段改为咨询确认。products.json、商品价格和店主填写的质保内容未改。

本地 52 项功能测试与 dist 构建通过，产物内 FAQ 页面、CSS、登录脚本通过 HTTP 检查。真实邮件及账号流程仍待用户实测。上线后须核验 FAQ 200、新 JS/CSS 匹配与实际缓存头，并查看 GitHub checks 结果。

## 成员个人空间（2026-11-03）

用户选择“个人主页：头像、昵称、简介、自定义链接和动态”，并明确授权“登录用户之间可互相查看主页和动态”。新增 space.html/js/css 与 lib/space.mjs；首页/商店/FAQ/工具站/备忘录/头像页均有入口，登录回跳支持 /space 和 /space.html。新空间默认以当前账号为本人，保存昵称后出现在成员目录；支持个人直达链接、目录分页、主页条件更新冲突保护、动态发布/隐藏/恢复与分页。

数据库 supabase/user-spaces.sql 新建 user_spaces、space_posts 和 member_spaces 只读 RPC：匿名无表/RPC权限，登录用户互读，只有本人可写；动态隐藏后只允许作者读取，不提供永久删除。资料链接有前后端校验，不嵌入 HTML，不存邮箱。店主已反馈执行全文并补齐动态 id 列插入权限。现有 avatars 公开桶和备忘录加密权限均未改变。操作与边界见 SPACE-GUIDE.md。

新增功能与回跳测试后共 58 项功能测试；数据库权限扩展为 87 项。测试为本地模拟 UI/隔离 SQL，不代表两个真实账号已经验收；线上应测试主页保存、成员互访、动态发布及隐藏。初版尚无举报/屏蔽、昵称搜索或动态编辑，应随用户规模后续评估，不要声称有这些能力。

## 成员空间社区增强（2026-11-03）

已实现动态编辑（版本条件更新、冲突保留草稿、已编辑时间）、按昵称字面子串搜索及分页；新增举报表单和店主专用举报管理（待处理/已处理分页，隐藏/忽略/恢复）。成员不能读取举报表或调用店主管理接口，作者不能移除店主隐藏状态，匿名不能搜索/举报。内容均以纯文本渲染。举报不自动隐藏内容，不提供永久删除或成员屏蔽。

新增 supabase/space-community.sql（先执行 user-spaces.sql），店主已反馈执行完成。触发器在数据库中限制发布间隔20秒、每日30条、账号总计500条（含隐藏），编辑间隔5秒；举报每天5条，同账号同动态去重。并发写入按账号加事务锁。日期按数据库日期（默认UTC）。增强后不要重跑旧基础 SQL 覆盖新版列授权和读取策略；新安装按基础→增强顺序。

本地61项功能测试、116项数据库权限检查通过；数据库检查包含动态编辑/CAS、昵称字面匹配、举报隐私与店主权限、隐藏恢复、发布间隔/每日/总量上限。真实双账号编辑、举报及店主处理仍须实测。

## 个人内容导出与容量（2026-11-03）

新增 lib/space-export.mjs 与个人空间本人专用的“我的内容与容量”。使用现有权限精确计数 space_posts（含隐藏），显示已用/500/剩余；接近或达到上限提示导出，但明确导出不会释放容量。未增加 SQL、删除功能或权限。

可下载个人主页、头像设置和全部本人动态为 JSON；核对实际登录用户，完整分页并双读比对，断网/变更/退出时停止，未保存草稿和头像原图不在范围。文件未加密，包含隐藏内容；不是备忘录备份，也暂不提供导入恢复。普通下载只提示发起下载，文件选择器在关闭写入成功后才提示写入完成。

新增分页、本人限制、变更/断网/退出、容量未知错误、取消选择/写盘/普通下载测试，总计73项功能测试。数据库 SQL 未修改，现有116项权限测试继续由 GitHub 自动检查。真实浏览器文件落盘仍需用户实际导出验证。

## 账号安全改进（2026-11-03）

新增 account.html/account.js 与 lib/account-security.mjs，提供已登录用户的邮箱验证改密入口和全设备注销（global）。发邮件前重新读取服务端当前用户，只向本人注册邮箱请求重置，退出失败不冒充成功；页面内60秒重发间隔只是体验保护，不是服务端限流。页面入口位于首页/成员空间/头像页，已加入白名单、打包和线上验收。

按用户最新偏好：新密码至少8位且同时含英文字母和数字，不要求大小写/符号，不再采用此前建议的12位。登录不使用新规则拦已有账号。注册/登录/重置相关表单完成后清空密码控件，认证错误不再原样写控制台。Supabase 服务端最小长度/组合策略尚未反馈配置，前端校验不能代替后端。

安全头移除 script-src unsafe-inline/unsafe-eval，并给 img-src 增加 blob 以兼容本地预览；原有样式 inline 来源仍保留。新增账号身份/邮件目标/global退出、密码规则及清空表单、无内联脚本检查；总计84项功能测试。当前未实现TOTP二步验证或服务端Cookie登录，已有访问令牌在全设备注销后仍可能有效到期，详情见 ACCOUNT-SECURITY.md。真实邮件/跨设备注销和浏览器CSP流程仍待实测。


## 成员屏蔽与安全状态更新（2026-11-03）

新增 supabase/space-blocks.sql，店主已反馈执行完成；线上真实双账号流程仍待实测。成员空间提供单向屏蔽/解除、本人私有名单与分页。新查询函数过滤本人屏蔽目标，动态 SELECT 策略也过滤目标作者；成员不能查看或修改别人的名单。屏蔽不通知对方，不阻止对方读取你的成员资料/动态，不作用于首页留言板或公开头像；这不是双向隐私访问控制。名单最多200位，设置/解除幂等，不永久删除内容。

新安装的 SQL 顺序为 avatars→user-spaces→space-community→space-blocks；不要在增强后重跑旧基础脚本覆盖新版函数和策略。新增4项界面回归与23项SQL检查，当前88项功能测试、139项数据库权限检查通过，真实双账号屏蔽/解除仍待实测。

密码设置更新：用户已明确反馈 Supabase 后台成功设置“至少8位、英文字母和数字”，此为用户反馈，未用真实新密码请求独立验证。此前“后台尚待确认”的历史表述不再代表当前反馈状态。当前尚未启用TOTP二步验证。


## 手机底部导航与安卓修复（2026-11-03）

新增mobile-nav.js/mobile.css到8个受守卫页面，底部：首页/商店/工具/我的/更多，兼容键盘、安全区、深浅模式、dialog关闭焦点和减少动态效果；桌面继续原导航。
番茄钟拆为focus.js与lib/focus.mjs。按账号在当前浏览器独立保存，修复后台暂停剩余时间和跨午夜次数；累计分钟不每日清零。移除“与App默认同步”误导，旧共用记录不自动归属任何账号。声音在点击启动时解锁，不能保证锁屏或后台提醒。
SW只缓存离线提示与装饰资源，不缓存配置/登录回跳/页面/用户数据；升级清理本应用旧缓存。新增离线页。
安卓新增系统文件选择、正式域名主框架限定的WebMessage分块导出（64MB上限）、安全外链和返回关闭弹窗；关闭明文、混合内容与应用备份，不增加全部文件权限。release去除debug签名回退，四个GitHub Secrets齐备才发布，工作流编译/签名/实际Release须单独确认。首次从旧debug签名迁移可能需卸载，须先保留本机数据，不得代用户卸载。
APK下载改为固定入口302到GitHub最新Release；旧仓库APK保留但不进入dist。签名配置与本机备份限制见ANDROID-GUIDE.md。
TASKS.md已重整，旧34/38计数不再作为当前任务基线。真实Android设备、真实账号/邮件和文件落盘仍需店主验收。

本轮隔离验证：105项功能测试（含分块导出的字节一致、取消、来源和并发检查）、139项SQL权限检查通过；本地dist HTTP与下载重定向配置已核验。Android编译和实际签名发布结果以后续GitHub工作流为准。


已合并首页白噪声后续提交并清理误提交的文档冲突标记；手机更多入口补伴读白噪声。专注钟发送真实状态事件供白噪声联动，兼容两组开始按钮及完成/休息/退出状态，只允许当前页面主动开始时自动播放，避免跨标签或恢复页面突然响声。修复暂停后迅速重播被旧淡出回调停止的竞态。移除不准确的脑波/全机型/固定19KB描述。Gradle默认versionName加括号后重新编译。

合并白噪声后新增3项联动/恢复不自动播放/快速重播竞态测试，共108项功能测试通过，数据库权限保持139项。

后续CI进一步定位到versionCode链式调用的Groovy DSL优先级；两个版本值现先在DSL外求值，再传给defaultConfig，避免调用返回null。以后以新构建结果为准。

## 本轮发布验收结果（2026-11-03）
代码285db4b已上线并同步本地，108项功能测试、139项隔离数据库检查以及50项正式站资源核验通过。浏览器模拟账号在320/390/768宽度验证首页底栏位置/无横向溢出/触控尺寸，更多菜单Escape关闭与焦点恢复通过；临时账号接口不访问真实用户数据。Android真机软键盘、上传、保存文件与旧版迁移仍待用户实测。
Android工作流41592813355编译、正式签名校验及Release发布成功：v1.1.7，源码285db4b，APK376296字节，SHA256 59c6d4e0c0947a8659c8c7dd73179bb421204790cab8427c34f09c67cb2ad8b5。实际下载已与校验文件和GitHub摘要一致。四个签名Secret已配置，签名保存在仓库外受限目录；不得重新随机生成取代已有签名。下载入口/lanmaospace.apk经302转向最新Release。


## 备忘录跨域名空列表排查（2026-11-03）
用户反馈Pages已解锁但列表无记录，旧Netlify有内容。只读核验两站Supabase URL/anon配置相同，旧正文/文件名协议与PBKDF2参数兼容；Pages按ownerUid验证，旧Netlify按ownerEmail验证（不在文档记录邮箱/密钥）。未读取真实笔记、登录凭证或口令。
发现并修复列表解密的整体失败路径：单条正文/附件名称异常不再导致全部可读内容隐藏，新增云端读取/正常/回收站/未解密/筛选计数与读取失败区别。完整备份继续使用严格decodeRows，不允许部分列表冒充完整备份；不修改库、不迁移密文、不改盐或校验串。清除搜索不会清草稿，取消刷新保留草稿。旧格式解锁、坏记录/坏附件、完整备份拒绝损坏数据等7项回归通过，共115项功能测试。
此改动已复现并修正一处可能路径，用户真实空列表的具体原因仍需新版同步状态栏反馈确认，不能先声称数据已恢复或已丢失。不要清空浏览器、重建vault或改口令试错。

店主后续实测反馈：新站云端记录已全部正常读取、解密和显示，无回收站或解密失败记录；本轮列表可见性问题已恢复。未读取正文，未改云端数据。初始空白的具体触发原因仍未独立确定，不能把此前找到的整体失败路径冒称为已证实的真实根因。继续以Pages为正式站，旧Netlify不再编辑。


## 追加回归与退出会话修复（2026-11-03）
复查115项功能与139项隔离SQL均通过，额外发现普通导航退出未指定scope、接口失败仍跳登录页，以及搜索后同步失败的显示数使用全部记录数。新增lib/signout.mjs：普通导航明确local，返回error或抛异常时不跳转、提示未确认退出并允许重试，双击只发送一次；备忘录退出也明确local，失败先锁定内容并说明会话未确认退出。账号安全页“退出所有设备”继续明确global，不改。
修正同步失败时“当前显示”取实际列表长度。新增7项退出成功/失败/并发、筛选后失败计数、备忘录锁定和重新选择备份撤销旧校验回归，共122项功能测试；139项数据库权限检查保持通过。全程仅模拟数据，不读取或改动真实备忘录、登录态或生产库。

## 2026-11-03：伴读声音更新

以远程实际 HEAD 和上线资源为准。旧 script.js 过程噪音引擎已移除，入口为 ambient.js，声音与播放器在 lib/ambient.mjs；audio/ 含 8 段本地 MP3 及哈希清单，构建白名单已加入。来源及版权见 AUDIO-SOURCES.md，必须保留署名。三档雨由同一实录不同片段制作；木鱼明确为合成，其余为实录选段/混音。

默认音量 40%，按需下载，最多缓存两段解码音频；处理取消、超时、迟到请求、暂停重播、系统暂停和键盘选择。真实时间定时到期会停止；后台持续播放不作承诺。没有改登录、数据库、备忘录、价格及部署设置。保留远程 7184896 的阅读器及兼容性修复。新增声音测试替代旧过程音测试；真人听感及 Android 真机长时间播放仍需用户试听。

本轮本地验证：145 项功能测试、139 项 PostgreSQL 权限检查通过；8 段音频已在浏览器实际解码播放，390px 手机布局无横向溢出。远程提交和上线状态需以发布后的核验记录为准。

阅读器耳机按钮也已接入同一套 8 种声音（reader-audio.js），支持底部面板选择、音量、暂停及原作者署名；面板打开不自动播放。reader.js 旧合成雨声已移除，保留原阅读器其他功能。
