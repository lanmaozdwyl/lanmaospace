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
- 留言板只把内容插入当前页面，刷新后丢失，没有服务端保存，不能称为真正可收件的留言系统。
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
