# Lanmao Space 🐱

蓝昴的个人学术空间与人工接单商店。

- **网站**：https://lanmaospace.netlify.app/
- **商店**：https://lanmaospace.netlify.app/store.html
- **开发交接**：[HANDOFF.md](HANDOFF.md)（换电脑或交给其他 agent 前先读）

## 功能

个人首页、书单筛选、音乐影视、友链、工具箱、工具站（`tools/`）、留言板（Supabase，需店主审核后显示）；商店包含商品分类、搜索、详情与 QQ 人工咨询。两页均有响应式布局和减少动态效果支持。

## 本地运行

纯 HTML / CSS / JavaScript，无需 npm 安装或构建。

```powershell
git clone https://github.com/lanmaozdwyl/lanmaospace.git
cd lanmaospace
python -m http.server 8766 --bind 127.0.0.1
```

访问 http://127.0.0.1:8766/ ，停止预览按 Ctrl+C。

## 部署

Netlify 项目 `lanmaospace` 关联 GitHub `main` 分支，发布目录为 `.`，推送后自动部署。需等待部署完成并检查正式网站。

## 当前边界

商店为人工接单，未接在线支付或自动发货；价格为人工维护。留言通过 Supabase 保存，审核后公开显示；联系方式受数据库列权限保护。具体维护说明及已知待完善项见 [HANDOFF.md](HANDOFF.md)。
