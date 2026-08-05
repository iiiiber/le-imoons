// scripts/generate-search-index.mjs
// 构建前生成 public/search.json 静态索引
// 零依赖, 纯手写 frontmatter 解析
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');
const OUT = join(ROOT, 'public', 'search.json');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// 极简 YAML 解析(支持 key: value, key: [a, b] 单行数组, - a - b 多行数组, ISO date)
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const [, fm, body] = m;
  const data = {};
  let currentList = null;
  for (const line of fm.split('\n')) {
    const itemMatch = line.match(/^\s+-\s+(.*)$/);
    if (itemMatch) {
      if (currentList) currentList.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const km = line.match(/^(\w+):\s*(.*)$/);
    if (km) {
      const [, k, v] = km;
      if (v === '' || v === undefined) {
        // 可能是列表
        currentList = [];
        data[k] = currentList;
      } else if (v === 'true' || v === 'false') {
        data[k] = v === 'true';
        currentList = null;
      } else if (v.startsWith('[') && v.endsWith(']')) {
        // 单行数组: [a, b, c]
        const inner = v.slice(1, -1).trim();
        data[k] = inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
        currentList = null;
      } else {
        // 去掉引号
        data[k] = v.replace(/^["']|["']$/g, '');
        currentList = null;
      }
    }
  }
  return { data, body };
}

const files = await walk(BLOG_DIR);
const index = [];

for (const f of files) {
  const raw = await readFile(f, 'utf-8');
  const { data, body } = parseFrontmatter(raw);
  if (data.draft) continue;

  const id = relative(BLOG_DIR, f).replace(/\.md$/, '');
  index.push({
    id,
    title: data.title || '',
    description: data.description || '',
    category: data.category || '',
    tags: data.tags || [],
    pubDate: data.pubDate ? new Date(data.pubDate).toISOString().slice(0, 10) : '',
    url: `/blog/${id}/`,
    excerpt: body.slice(0, 300).replace(/[#*`>\-\[\]]/g, '').trim(),
  });
}

index.sort((a, b) => b.pubDate.localeCompare(a.pubDate));

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(index, null, 2), 'utf-8');
console.log(`✓ Generated ${OUT} (${index.length} entries)`);
