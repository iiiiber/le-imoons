// src/pages/rss.xml.ts
// 静态 RSS 2.0 feed - 构建时生成, 走 /rss.xml
// 跑 npm run build 时 Astro 调 GET handler, 返 xml 字符串
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://le.imoons.cn';
const TITLE = '鹏飞日记';
const DESC = '写点技术，写点生活。AI / Docker / 量化 / 副业折腾。';
const AUTHOR = '鹏飞 (buer@imoons.cn)';
const LANG = 'zh-CN';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const all = await getCollection('blog', ({ data }) => !data.draft);
  // 按 pubDate 倒序, 最新在前
  const sorted = [...all].sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );

  const items = sorted
    .map((post) => {
      const link = `${SITE}/blog/${post.id}/`;
      const pubDate = post.data.pubDate.toUTCString();
      const categories = (post.data.tags || [])
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join('\n');
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.data.description || '')}</description>
${categories}
    </item>`;
    })
    .join('\n');

  const lastBuild = new Date().toUTCString();
  // 最新文章时间 = feed 更新时间
  const latestPub = sorted[0]?.data.pubDate.toUTCString() || lastBuild;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE}</link>
    <description>${escapeXml(DESC)}</description>
    <language>${LANG}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <pubDate>${latestPub}</pubDate>
    <managingEditor>${AUTHOR}</managingEditor>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
