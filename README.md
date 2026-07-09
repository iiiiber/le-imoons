# imons 博客

个人博客，技术笔记 + 生活随笔。

## 技术栈

- [Astro 7](https://astro.build) - 静态站点生成器
- 原生 CSS 变量主题（暗色优先）
- [Giscus](https://giscus.app) - 基于 GitHub Discussions 的评论（可选）

## 开发

```bash
npm install
npm run dev          # http://localhost:4321
```

## 写文章

在 `src/content/blog/` 下新建 `.md` 文件，文件名就是 URL slug。

frontmatter 必填：

```yaml
---
title: 文章标题
description: 一句话简介
pubDate: 2026-07-07
category: tech   # 或 life
tags: [标签1, 标签2]
draft: false     # true 不会出现在列表
---
```

## 启用 Giscus 评论

1. 在 https://giscus.app/zh-CN 配置 GitHub 仓库
2. 复制 `.env.example` 为 `.env`，填入 4 个变量
3. 重启 dev server

## 构建 & 部署

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览构建结果
```

适合部署到 Cloudflare Pages / Vercel / Netlify。

<!-- trigger rebuild at 2026-07-08T07:52:22Z -->

<!-- trigger cf-pages rebuild after secrets fix 2026-07-09 01:50 -->

<!-- trigger CF Pages rebuild after CLOUDFLARE_API_TOKEN filled 2026-07-09 01:55 -->

<!-- trigger 2026-07-09 02:30:00 force production alias -->
