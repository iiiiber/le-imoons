// @ts-check
import { defineConfig } from 'astro/config';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { rehypeDemoteH1 } from './scripts/remark-demote-h1.mjs';

export default defineConfig({
  site: 'https://le.imoons.cn',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
    rehypePlugins: [
      // 把 markdown 的 h1 降级为 h2 (避免与 hero 区域 h1 重复)
      rehypeDemoteH1,
      // 给 h2/h3 加 id（用于 TOC 锚点）
      rehypeSlug,
      // 给标题加 # 链接符号，悬停可点
      [rehypeAutolinkHeadings, {
        behavior: 'append',
        properties: { className: ['heading-anchor'], ariaLabel: 'Anchor link' },
        content: { type: 'text', value: '#' },
      }],
    ],
  },
});
