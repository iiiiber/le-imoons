---
title: "用 Astro 搭建个人博客"
description: "从零开始用 Astro 7 搭建一个支持技术笔记和生活随笔分类的博客,集成 Giscus 评论,准备部署到 Cloudflare Pages。"
pubDate: 2026-07-07
category: tech
subcategory: "前端全栈"
tags: ["Astro", "博客", "静态站点"]
---

## 为什么选 Astro

Astro 的核心卖点是 **"默认零 JS"**——生成的页面在浏览器不跑任何 JS（除非显式加 `client:*` 指令）。对于内容为主的博客来说，这正好契合：

- 加载快（首屏只有 HTML + CSS）
- SEO 友好
- 部署简单（产出纯静态文件）

## 核心结构

```
src/
  content.config.ts     # 内容集合定义
  content/blog/         # 所有 .md 文章
  layouts/              # 共享布局
  components/           # 复用组件
  pages/                # 路由(基于文件系统)
```

## 内容集合（Content Collections）

Astro 7 用 `glob` loader 把 markdown 文件注册为类型化集合：

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['tech', 'life']),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});
```

这样每篇文章都自动获得 TypeScript 类型校验，写错 `category` 立刻报错。

## 分类页

`/tech` 和 `/life` 两个路由用同一个模板筛选不同 `category`：

```astro
---
const posts = (await getCollection('blog', ({ data }) =>
  data.category === 'tech' && !data.draft
)).sort((a, b) => b.data.pubDate - a.data.pubDate);
---
```

## Giscus 评论

评论区用 [Giscus](https://giscus.app/)，基于 GitHub Discussions 免维护。只需要在 `.env` 配 4 个变量就能启用。

## 下一步

部署到 Cloudflare Pages 直接连 GitHub 仓库即可，build 命令 `npm run build`，输出目录 `dist`。
