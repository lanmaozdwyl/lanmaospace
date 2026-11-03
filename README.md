# Lanmao Space 🐱

蓝昴的阅读与专注空间。

- **网站**：https://lanmaospace.pages.dev/
- **开发交接**：[HANDOFF.md](HANDOFF.md)（换电脑或交给其他 agent 前先读）

## 功能

当前首页聚焦阅读器、自然声音和专注钟，保留留言板；成员空间、店主备忘录、头像与账号安全从“我的”进入。商店、音乐影视、工具导航/工具站、阅读书单、友情链接已按店主要求暂时隐藏入口和首页区块，原页面及数据保留，商品价格和 QQ 人工接单方式未修改。私人备忘录详见 [MEMO-GUIDE.md](MEMO-GUIDE.md)。

手机端提供底部功能导航与本机专注钟；搜索、更多菜单和阅读面板按可见视口适配窄屏与键盘，搜索支持触屏关闭和独立滚动。Android安装与维护见 [ANDROID-GUIDE.md](ANDROID-GUIDE.md)，当前任务见 [TASKS.md](TASKS.md)。

## 本地运行

纯 HTML / CSS / JavaScript，本地预览无需 npm 安装或构建；部署时 Cloudflare 会执行 `node scripts/build.mjs`（先做语法检查与测试，再打包到 dist）。

```powershell
git clone https://github.com/lanmaozdwyl/lanmaospace.git
cd lanmaospace
python -m http.server 8766 --bind 127.0.0.1
```

访问 http://127.0.0.1:8766/ ，停止预览按 Ctrl+C。

## 部署

Cloudflare Pages 免费项目 `lanmaospace` 关联 GitHub `main` 分支，Framework 为 None，构建命令为 `node scripts/build.mjs`，发布目录为 `dist`，推送后自动部署。运行 `node scripts/verify-live.mjs` 核验新站资源。

## 当前边界

商店为人工接单，未接在线支付或自动发货；价格为人工维护。留言通过 Supabase 保存，审核后公开显示；联系方式受数据库列权限保护。具体维护说明及已知待完善项见 [HANDOFF.md](HANDOFF.md)。

## 最近部署状态

正式站为 Cloudflare Pages（https://lanmaospace.pages.dev/），推送 main 后自动构建部署；用 `node scripts/verify-live.mjs` 核验（2026-11-02 已扩展覆盖商店/工具站/首页/登录页与商品图片）。Netlify 旧站不再更新。

## 自然伴读声音（2026-11-03）

首页提供溪流、小雨、中雨、大雨、慢敲木鱼、寺院远钟、海浪、林间鸟鸣与风声。自然声为开放实录，木鱼为自制柔和合成音；三档雨由同一实录分段处理。点击后才加载，支持淡入淡出、定时和专注钟联动。来源与离线制作方法见 [AUDIO-SOURCES.md](AUDIO-SOURCES.md)。

阅读器耳机按钮也已接入同一套 8 种声音（reader-audio.js），支持底部面板选择、音量、暂停及原作者署名；面板打开不自动播放。reader.js 旧合成雨声已移除，保留原阅读器其他功能。
