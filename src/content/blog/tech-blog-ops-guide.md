---
title: "博客自建运维指南"
description: "从日常更新到问题排查，完整的博客站点运维手册，涵盖 Astro + Cloudflare Pages + Git 操作。"
pubDate: 2026-07-08
category: tech
tags: ["运维", "Cloudflare", "Git", "博客", "Astro"]
draft: false
---

# 博客自建运维指南

> 适用环境：Linux / Node.js ≥ 22 / Astro 7 / Cloudflare Pages
> 编写日期：2026-07-08
> 适用场景：个人博客日常维护、内容更新、问题排查

---

## 一、日常更新流程

### 1. 写文章

在 `src/content/blog/` 下新建 `.md` 文件：

```bash
cd /workspace
touch src/content/blog/tech-new-post.md
```

文章 frontmatter 格式：

```yaml
---
title: "文章标题"
description: "一句话简介（用于搜索和 SEO）"
pubDate: 2026-07-08
category: tech   # 技术笔记填 tech，生活随笔填 life
tags: ["标签1", "标签2", "标签3"]
draft: false     # true 为草稿，不会出现在列表中
---

正文内容（Markdown 格式）...
```

**命名规则**：
- 技术类：`tech-xxx.md` → 访问地址 `/blog/tech-xxx/`
- 生活类：`life-xxx.md` → 访问地址 `/blog/life-xxx/`

### 2. 本地预览（可选）

```bash
npm run dev    # 启动开发服务器，访问 http://localhost:4321
```

确认文章显示正常后再部署。

### 3. 构建并部署

```bash
# 清理缓存（重要！避免 CSS 等资源不同步问题）
rm -rf node_modules/.cache dist

# 安装依赖 + 构建
npm install && npm run build

# 部署到 Cloudflare Pages（替换为你的实际值）
CLOUDFLARE_ACCOUNT_ID=your-account-id \
CLOUDFLARE_API_TOKEN=your-api-token \
npx wrangler pages deploy dist --project-name=blog-imoons --branch=main --commit-dirty=true
```

---

## 二、本地开发环境

### 环境要求

| 项目 | 版本 |
|------|------|
| Node.js | ≥ 22.12.0 |
| npm | ≥ 10.x |

### 首次安装

```bash
cd /workspace
npm install
```

### 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本（输出到 dist/）
npm run preview      # 预览构建结果
npm run astro check  # 类型检查
```

---

## 三、Cloudflare 管理

### 控制台访问

| 入口 | URL |
|------|-----|
| Cloudflare Pages | https://dash.cloudflare.com/518388fcb011cae32a36f58000f27e7f/pages |
| blog-imoons 项目 | https://dash.cloudflare.com/518388fcb011cae32a36f58000f27e7f/pages/view/blog-imoons |

### 常用操作

| 操作 | 说明 |
|------|------|
| **自定义域名** | 添加 `le.imoons.cn` 并设置 CNAME 记录 |
| **部署历史** | 查看每次部署记录，支持一键回滚 |
| **环境变量** | 配置 API key 等敏感信息（如评论系统密钥） |
| **缓存清除** | 页面显示异常时手动清除 CDN 缓存 |
| **访问分析** | 查看访问量、用户地区、浏览器等统计 |

---

## 四、Git 操作

### 代码仓库

```
GitHub: https://github.com/iiiiber/le-imoons
默认分支: main
```

### 常用命令

```bash
# 查看状态（检查哪些文件被修改）
git status

# 添加所有改动
git add -A

# 提交（写清楚改动内容）
git commit -m "feat: add new article about blog ops"

# 推送到 GitHub
git push origin main
```

### 分支管理

开发新功能时使用分支：

```bash
# 创建新分支
git checkout -b feature/new-theme

# 完成后合并到 main
git checkout main
git merge feature/new-theme
git push origin main
```

---

## 五、常见问题排查

### 问题 1：页面样式丢失（像乱码）

**现象**：页面文字正常，但没有样式，所有内容挤在一起

**原因**：CSS 文件未正确上传或 CDN 缓存了旧内容

**解决**：
```bash
rm -rf node_modules/.cache dist
npm install && npm run build
# 重新部署（见上方部署命令）
```

### 问题 2：新文章不显示

**原因**：`draft: true` 或构建缓存

**解决**：
1. 检查文章 frontmatter 的 `draft: false`
2. 清理缓存重新构建

### 问题 3：访问页面返回 404

**原因**：文件路径不对或部署未成功

**解决**：
1. 检查 `dist/` 目录是否存在对应 HTML 文件：
   ```bash
   ls dist/blog/tech-new-post/
   ```
2. 确认部署时用了 `--branch=main` 参数

### 问题 4：搜索功能不工作

**原因**：`public/search.json` 未生成或内容为空

**解决**：
```bash
npm run build
cat public/search.json   # 检查是否包含文章数据
```

### 问题 5：Cloudflare Pages 部署失败

**原因**：网络不稳定或认证信息错误

**解决**：
1. 检查 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN` 是否正确
2. 确保网络连接稳定
3. 重试部署

---

## 六、配置文件说明

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖管理和脚本命令 |
| `astro.config.mjs` | Astro 配置（输出模式、插件、构建选项） |
| `src/content/config.ts` | 内容集合配置（文章类型、校验规则） |
| `public/_redirects` | Cloudflare 重定向规则 |
| `public/_headers` | HTTP 响应头配置（可添加缓存策略） |
| `scripts/generate-search-index.mjs` | 搜索索引生成脚本（构建时自动执行） |

---

## 七、备份建议

### 自动备份（推荐）

GitHub 已自动备份代码。每次 `git push` 后，代码会同步到 GitHub。

### 手动备份

```bash
# 导出所有文章
cp -r src/content/blog/ ~/backup/blog-posts/

# 导出配置文件
cp astro.config.mjs package.json ~/backup/
```

---

## 八、快速参考表

| 任务 | 命令/操作 |
|------|----------|
| 写文章 | 在 `src/content/blog/` 新建 `.md` |
| 本地预览 | `npm run dev` |
| 构建 | `npm run build` |
| 部署 | `CLOUDFLARE_xxx npx wrangler pages deploy dist --project-name=blog-imoons --branch=main --commit-dirty=true` |
| 查看部署记录 | `npx wrangler pages deployment list --project-name=blog-imoons` |
| 清理缓存 | `rm -rf node_modules/.cache dist` |
| 代码提交 | `git add -A && git commit -m "..." && git push origin main` |

---

## 九、注意事项

1. **部署前清理缓存**：每次部署前执行 `rm -rf node_modules/.cache dist`，避免 CSS/JS 资源不同步
2. **使用 `--branch=main`**：确保部署到 production 分支，否则会部署到临时预览地址
3. **定期备份**：虽然 GitHub 有备份，但建议定期导出文章内容
4. **CDN 缓存**：Cloudflare CDN 缓存时间较长（默认 7 天），如果页面显示异常，强制刷新浏览器（`Ctrl+Shift+R`）
5. **API Token 安全**：不要把 `CLOUDFLARE_API_TOKEN` 提交到代码仓库，使用环境变量或 GitHub Secrets

---

如有其他运维问题，欢迎在评论区交流。
