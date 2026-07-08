// src/pages/sitemap-index.xml.ts
// 静态 sitemap-index (引用子 sitemap)
// 实际 Google 推荐拆成多个子 sitemap, 但 <50 URL 的话一个就够了
// 这里用单文件 sitemap.xml 风格, Google 也认
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://le.imoons.cn';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const GET: APIRoute = async () => {
  const all = await getCollection('blog', ({ data }) => !data.draft);

  // 静态页面
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/blog/', priority: '0.9', changefreq: 'daily' },
    { loc: '/tech/', priority: '0.8', changefreq: 'weekly' },
    { loc: '/life/', priority: '0.8', changefreq: 'weekly' },
    { loc: '/about/', priority: '0.7', changefreq: 'monthly' },
    { loc: '/search/', priority: '0.5', changefreq: 'monthly' },
  ];

  // 文章详情页
  const postPages = all
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
    .map((post) => ({
      loc: `/blog/${post.id}/`,
      lastmod: post.data.updatedDate?.toISOString() || post.data.pubDate.toISOString(),
      priority: '0.8',
      changefreq: 'monthly',
    }));

  const allPages = [
    ...staticPages.map((p) => ({ ...p, lastmod: new Date().toISOString() })),
    ...postPages,
  ];

  const urls = allPages
    .map(
      (p) => `  <url>
    <loc>${SITE}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
