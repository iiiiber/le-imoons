---
title: "le.imoons.cn 部署与运维指南"
description: "从零到上线: nginx 反代 + PM2 dev mode + GitHub Actions + wrangler CF Pages 部署, Giscus 评论, SEO 三件套, 文章详情页 D 方案 TOC, 完整故障排查速查表."
pubDate: 2026-07-09
category: tech
subcategory: "运维工具"
tags: ["Astro", "nginx", "PM2", "GitHub Actions", "Cloudflare Pages", "wrangler", "Giscus", "部署", "运维"]
draft: false
---

# le.imoons.cn 部署与运维指南

## 0. 项目速览

| 字段 | 值 |
|---|---|
| 主域名 | `le.imoons.cn` (本地 + 本地 nginx) |
| 静态域名 | `https://blog.leeeo.cn` (CF Pages + 自定义域) |
| 备用默认 | `https://blog-imoons.pages.dev` |
| 源码根 | `/www/wwwroot/le.imoons.cn/` |
| 文章目录 | `src/content/blog/` (14 篇) |
| 框架 | Astro 7.0.6 + content collections + rehype 插件链 |
| dev server | PM2 `le-imoons-dev` → `0.0.0.0:4321` |
| 生产部署 | GitHub Actions → `wrangler pages deploy` → CF Pages |
| HTTPS | ZeroSSL ECC DV, 2026-10-05 到期 (acme.sh 自动续) |
| 评论 | Giscus (`blog-comments` repo, 4 个 PUBLIC env) |

---

## 1. 部署链全景

le.imoons.cn 走 **双轨**架构 (本机可改可调试, CF Pages 自动部署上线):

```
代码修改
  │
  ├─→ 本地 PM2 dev (4321) ──nginx 80/443──→ https://le.imoons.cn
  │   (改 .md / .astro 即时 HMR, 不需部署)
  │
  └─→ git push origin main
        └─→ GitHub Actions (.github/workflows/deploy.yml)
              ├─ npm ci
              ├─ npm run build (4 个 Giscus env 从 Secrets 注入)
              └─ wrangler pages deploy dist --project-name=blog-imoons
                    └─→ Cloudflare Pages
                          └─→ https://blog-imoons.pages.dev
                                └─→ https://blog.leeeo.cn (自定义域 CNAME)
```

**两套域名是同一份 CF Pages 项目**, 任意入口都能访问。**改动通过 git push 触发 CI/CD** 才会同步到线上。

---

## 2. 本地 dev mode (PM2 + astro dev)

### 启动

```bash
cd /www/wwwroot/le.imoons.cn
pm2 start "npm run dev -- --host 0.0.0.0 --port 4321" \
  --name le-imoons-dev --cwd /www/wwwroot/le.imoons.cn
pm2 save && pm2 startup
```

`predev` 钩子自动跑 `scripts/generate-search-index.mjs` 生成 `public/search.json` (供 `/search/` 页面用)。

### 保活与重启

| 操作 | 命令 |
|---|---|
| 看状态 | `pm2 list \| grep le-imoons-dev` |
| 重启 | `pm2 restart le-imoons-dev` |
| 看日志 | `pm2 logs le-imoons-dev --lines 50` |
| 看错误 | `pm2 logs le-imoons-dev --lines 50 --err` |
| 停 | `pm2 stop le-imoons-dev` |
| 完全删除 | `pm2 delete le-imoons-dev` |

### HMR 行为

- 改 `.md` / `.astro` 模板 → 即时生效, 不用重启
- 改 `package.json` (加依赖) → 必须 `npm install` + `pm2 restart`
- 改 `<style is:global>` 块的 `:root` 变量 → **HMR 不可靠, 主动 `pm2 restart`**
- dev server 崩溃循环 (`↺` 计数 > 5, status `1…`) → 改的代码**不**会生效, 先修根因

---

## 3. nginx 反代配置

文件: `/www/server/panel/vhost/nginx/le.imoons.cn.conf`

### 关键段

```nginx
server {
    listen 80;
    server_name le.imoons.cn;
    # 80 永久跳 443
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name le.imoons.cn;
    root /www/wwwroot/le.imoons.cn/dist;  # 502 时 fallback

    ssl_certificate     /www/server/panel/vhost/cert/le.imoons.cn/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/le.imoons.cn/privkey.pem;

    # 静态资源 + 反代
    location /@vite/ { proxy_pass http://127.0.0.1:4321; }
    location / { proxy_pass http://127.0.0.1:4321; }

    # dev server 挂时降级到静态 dist
    location @static_fallback {
        root /www/wwwroot/le.imoons.cn/dist;
        try_files $uri $uri/ =404;
    }
    error_page 502 503 504 @static_fallback;
}
```

### 3 个易踩的坑

1. **`error_page 404 /404.html;`** ❌ — 会拦截**所有**反代 404 (含 dev server 返回的 404), 强制改写为 `/404.html` 请求 → dev 模式下失效. **删掉**.
2. **`location ~ .*\.(png|gif|...)$` regex** ❌ — 没有 `proxy_pass/try_files` 声明, 命中后 fall through 到 `root` 找静态文件 → dev mode 下 dist 是空的, **所有静态资源 403**. **删掉**.
3. **deprecation warning** `markdown.remarkPlugins/rehypePlugins` — Astro 7 默认 Sätteri 处理器, `rehypePlugins` 配置触发 warning. **不影响运行**, 但未来 Astro 8 升级时要换 API.

### 重新加载

```bash
nginx -t                              # 测配置
nginx -s reload                       # 重新加载 (不中断)
# 或: /www/server/panel/vhost/nginx/le.imoons.cn.conf 改完保存后, 宝塔面板 Nginx → 重载配置
```

### SSL 续期

`acme.sh` 装的 ZeroSSL ECC 证书, 到期前 30 天自动续, `--reloadcmd` 调 `nginx -s reload`. 手动续:

```bash
~/.acme.sh/acme.sh --renew -d le.imoons.cn --ecc
nginx -s reload
```

---

## 4. GitHub Actions 自动部署

文件: `.github/workflows/deploy.yml`

### 4 个 GitHub Secrets (必填)

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | wrangler 调 CF API 用, 权限 = `Edit Cloudflare Pages` |
| `CLOUDFLARE_ACCOUNT_ID` | CF 账号 ID, 12 字符 hex |
| `PUBLIC_GISCUS_REPO` | `iiiiber/blog-comments` |
| `PUBLIC_GISCUS_REPO_ID` | `R_kgDOTQsEMQ` |
| `PUBLIC_GISCUS_CATEGORY` | `General` |
| `PUBLIC_GISCUS_CATEGORY_ID` | `DIC_kwDOTQsEMc4DAtBv` |

### 触发

- `push main` → 自动部署
- `Actions 标签 → Run workflow` → 手动触发

### 部署链

```yaml
- npm ci                 # 装依赖
- npm run build          # 生成 dist/, Giscus env 从 Secrets 注入
- wrangler pages deploy dist \
    --project-name=blog-imoons \
    --branch=main \
    --commit-dirty=true
```

### 看部署结果

1. GitHub repo → **Actions** 标签 → 看 `Deploy to Cloudflare Pages` workflow
2. CF Dashboard → `blog-imoons` → **部署** 标签 → 看 build log + 部署时间

---

## 5. Giscus 评论配置

### 4 个 PUBLIC_GISCUS_* 凭据 (本地 + GitHub Secrets 两处都要)

来源: GitHub `blog-comments` repo (public, Discussions 已开) GraphQL API 拿的:

| 变量 | 值 |
|---|---|
| `PUBLIC_GISCUS_REPO` | `iiiiber/blog-comments` |
| `PUBLIC_GISCUS_REPO_ID` | `R_kgDOTQsEMQ` |
| `PUBLIC_GISCUS_CATEGORY` | `General` |
| `PUBLIC_GISCUS_CATEGORY_ID` | `DIC_kwDOTQsEMc4DAtBv` |

### 必须用户手动做的 1 件事

去 https://github.com/apps/giscus → **Install** → 选 `blog-comments` repo → Authorize.

**这一步是硬限制, agent 无法程序化绕过** (GitHub App OAuth 必须用户浏览器授权).

### 本地 dev 注入

`.env` 文件 (4 行):

```env
PUBLIC_GISCUS_REPO=iiiiber/blog-comments
PUBLIC_GISCUS_REPO_ID=R_kgDOTQsEMQ
PUBLIC_GISCUS_CATEGORY=General
PUBLIC_GISCUS_CATEGORY_ID=DIC_kwDOTQsEMc4DAtBv
```

---

## 6. SEO 三件套

文件:

- `src/pages/rss.xml.ts` — RSS 2.0 feed (14 items, 9.4KB)
- `src/pages/sitemap-index.xml.ts` — sitemap (20 URL, 3.9KB)
- `public/robots.txt` — `User-agent: *` + `Sitemap: ...` (167B)

### 3 个易踩的坑

1. **CF Pages 默认 robots.txt 覆盖** ⚠️ — 某些项目配置下 CF 会**自动**生成默认 robots.txt (含 content signals), 覆盖 `public/robots.txt`. **真验证**: `curl https://blog.leeeo.cn/robots.txt | grep -c "content signal"` → 期望 0.
2. **Bot Fight Mode (1010) 拦截 RSS reader** — Python urllib / curl 默认 UA 返 403. 不影响真实浏览器 + Google bot.
3. **OG meta 缺失** — trae 重构版 `BaseLayout.astro` 只 16255B, **没** OG / canonical / Twitter Card. 如果要社交分享卡片, 要手动加 9 个 Props + head meta 块.

---

## 7. 文章详情页 D 方案 TOC

`src/pages/blog/[...slug].astro` 用 **D 方案** (flex 横向 + sticky):

```css
.post-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 2rem;           /* prose 和 toc 之间 32px */
}
.post-layout > .prose { flex: 1 1 auto; min-width: 0; }
.toc-desktop {
  flex: 0 0 220px;
  position: sticky;    /* sticky 跟随滚动, 不是 fixed */
  top: 6rem;
  max-height: calc(100vh - 8rem);
  overflow-y: auto;
}
```

**演进史**: A 方案 (prose 760 居中 + TOC fixed 1320 公式) → B (prose 1024 撑满 + 段落 760) → D (flex 横向 + sticky).

### rehype h1 demote 防标题重复

`scripts/remark-demote-h1.mjs` 把 markdown `#` 降级为 h2 + class `demoted-from-h1`, prose 内 CSS 隐藏.

**配套的 tocItems 过滤** (headings.text 末尾被 autolink 加 `#` 装饰, 必须 strip):

```js
const tocItems = (headings || []).filter((h) => {
  if (h.depth !== 2 && h.depth !== 3) return false;
  const cleanText = (h.text || '').replace(/#+\s*$/, '').trim();
  if (cleanText === post.data.title) return false;
  return true;
});
```

**astro.config.mjs 接入**:

```js
import { rehypeDemoteH1 } from './scripts/remark-demote-h1.mjs';
markdown: {
  rehypePlugins: [
    rehypeDemoteH1,            // 必装在 rehypeSlug 之前
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: 'append', content: { type: 'text', value: '#' } }],
  ],
}
```

### BaseLayout `wide` prop (双模式 max-width)

| 模式 | max-width | 用在哪 |
|---|---|---|
| 默认 (窄) | `var(--max-w)` = 760px | 文章详情页 (阅读黄金宽) |
| `wide=true` | `var(--max-w-wide)` = 1024px | 首页 / 列表 / 404 / about / search |

**用法**: `<BaseLayout title="..." wide>` (容器页) vs `<BaseLayout title="...">` (文章详情).

---

## 8. 内容归档 4 步强校验

新增文章必须走完 4 步, **任何一步失败立刻停**, 不许脑补"成功了".

### 4 步 checklist

```bash
# 1. 草稿路径规划 (先看, 再写)
ls /www/wwwroot/le.imoons.cn/src/content/blog/ | sort
NEW="/www/wwwroot/le.imoons.cn/src/content/blog/tech-<slug>.md"
[ -f "$NEW" ] && echo "❌ 撞名" && exit 1

# 2. frontmatter schema 校验
# 必填: title (string) / description (string) / pubDate (YYYY-MM-DD) / category (tech|life)
# 可选: updatedDate / tags (string[]) / draft (bool, 默认 false)

# 3. 文件真存在
ls -la "$NEW"  # 字节数 > 0 + mtime 在 30 秒内

# 4. HMR 真生效 (URL 含 category 前缀, 4 次重试 12s)
URL="https://le.imoons.cn/blog/tech-<slug>/"
for i in 1 2 3 4; do
  sleep 3
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "${URL}?_=$(date +%s%N)")
  [ "$STATUS" = "200" ] && break
done
```

### 自动化脚本

```bash
bash /www/wwwroot/le.imoons.cn/scripts/archive-article.sh \
  tech <slug> "<title>" "<description>" <tag1> <tag2>
```

脚本自带 4 步校验, 失败 exit 1.

### slug 工具

中文标题自动转拼音 (pypinyin), 短词组 (< 4 字符) 兜底用 `post-MMDD-HHMM`:

```bash
echo "AI 入门" | python3 /www/wwwroot/le.imoons.cn/scripts/to_slug.py
# 短结果 'ai' (1 字符) 不可用, 手动给 slug: ai-intro
```

---

## 9. 故障排查速查表

| 症状 | 根因 | 修法 |
|---|---|---|
| le.imoons.cn 502 | dev server 死 | `pm2 restart le-imoons-dev` |
| dev server 启动报 `Cannot find module 'rehype-slug'` | npm install 没装上 | `npm install` (持久化, 别 `--no-save`) |
| HMR 改了 .md 不生效 | dev server 崩溃循环 | 看 `pm2 logs`, 修根因, `pm2 restart` |
| HMR 改了 `:root --xxx` 不生效 | Astro HMR 不推 CSS 变量 | `pm2 restart le-imoons-dev` |
| `/rss.xml` 404 | dist 没生成 | `npm run build` 看错, 检查 rss.xml.ts 语法 |
| `/blog/<slug>/` 一直 404 | 漏 category 前缀 | URL 应该是 `/blog/tech-<slug>/` 不是 `/blog/<slug>/` |
| frontmatter 报错 | YAML 解析失败 | `tags: ["A", "B"]` 加引号; `pubDate: 2026-07-09` 不用斜杠 |
| `og:title` 不在 HTML 里 | BaseLayout 没传 Props | trae 重构版默认没 OG meta, 要手动加 |
| `robots.txt` 是 CF 默认 | CF Pages 自动覆盖 | 改用 `src/pages/robots.txt.ts` endpoint 路由 |
| `pm2 restart` 报 `Process not found` | PM2 daemon 整个挂了 | `ps aux \| grep PM2` 看 daemon → `pm2 resurrect` |
| 改了 package.json 不生效 | npm 没装 | `npm install` + `pm2 restart` |
| `npm install` 报 `EACCES` | root 跑 npm 改 www 的 node_modules | 看是不是 www 用户装的, 用 `sudo -u www npm install` 或 `chown -R` |
| Giscus 不显示 | 4 个 env 缺一个 | 检查 `.env` (本地) / GitHub Secrets (CI) |
| Giscus 显示但报 "评论加载失败" | giscus GitHub App 没装 | https://github.com/apps/giscus → Install → 选 blog-comments |
| 静态资源 403 | nginx regex location 抢前缀 | 删 `location ~ .*\.(png|gif|...)$` 段 |
| 反代 404 显示成 404.html | `error_page 404` 跟反代冲突 | 删 `error_page 404 /404.html;` |
| 改了 .astro 模板 12s 后仍 404 | dev server 没识别 | `pm2 restart le-imoons-dev` + 等 6s |

---

## 10. 备份与恢复

### 本地源码备份

```bash
# 完整备份 (含 node_modules, 300M+)
cp -a /www/wwwroot/le.imoons.cn /www/wwwroot/le.imoons.cn.backup-$(date +%Y%m%d)

# 仅代码 + md (不含 node_modules, 几 MB)
rsync -a --exclude=node_modules --exclude=.git --exclude=dist \
  /www/wwwroot/le.imoons.cn/ /www/wwwroot/le.imoons.cn.code-$(date +%Y%m%d)/
```

### 同步 GitHub → 本地 (codeload 走 zipball, 绕 GnuTLS)

```bash
# 1. 拉 main HEAD zip
curl -sS -o /tmp/le-imoons.zip \
  https://codeload.github.com/iiiiber/le-imoons/zip/refs/heads/main

# 2. 解压
unzip -q /tmp/le-imoons.zip -d /tmp/

# 3. 备份本地 + 覆盖
mv /www/wwwroot/le.imoons.cn /www/wwwroot/le.imoons.cn.local-backup-$(date +%Y%m%d)
cp -a /tmp/le-imoons-main /www/wwwroot/le.imoons.cn

# 4. 复用 node_modules (省重装)
ln -s /www/wwwroot/le.imoons.cn.local-backup-*/node_modules \
  /www/wwwroot/le.imoons.cn/node_modules

# 5. 恢复 .env (Giscus 凭据)
cp /www/wwwroot/le.imoons.cn.local-backup-*/.env \
  /www/wwwroot/le.imoons.cn/.env

# 6. 重启 dev server
pm2 restart le-imoons-dev
```

**根因**: `git clone` 走 GnuTLS 协议在 124.223.155.35 → github.com 443 经常 timeout (-110). `codeload.github.com` 是 GitHub 的 zipball CDN, 0.5-1.5s 能连上.

### 14 篇 md 单文件恢复

```bash
# 从 GitHub 拉单文件 (走 Contents API, 不走 git 协议)
curl -sS "https://api.github.com/repos/iiiiber/le-imoons/contents/src/content/blog/<file>.md" \
  | python3 -c "import sys, json, base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())"
```

---

## 11. 关键命令速记

```bash
# === 本地开发 ===
pm2 list | grep le-imoons-dev         # 状态
pm2 restart le-imoons-dev            # 重启
pm2 logs le-imoons-dev --lines 30    # 实时日志
cd /www/wwwroot/le.imoons.cn && npm run build  # 手动 build (验证)

# === 部署 ===
git push origin main                  # 触发 GitHub Actions → wrangler
gh workflow run "Deploy to Cloudflare Pages"  # 手动 trigger

# === nginx ===
nginx -t                              # 测配置
nginx -s reload                       # 重新加载
cat /www/server/panel/vhost/nginx/le.imoons.cn.conf  # 看配置

# === SSL ===
~/.acme.sh/acme.sh --renew -d le.imoons.cn --ecc
echo | openssl s_client -servername le.imoons.cn -connect le.imoons.cn:443 2>/dev/null \
  | openssl x509 -noout -dates  # 看证书到期

# === 验证 (5 步) ===
HASH="https://blog.leeeo.cn"
for p in / /rss.xml /sitemap-index.xml /robots.txt; do
  curl -sS -o /dev/null -w "%{http_code}  $p\n" \
    -H "User-Agent: Mozilla/5.0 Chrome/126.0.0.0" "$HASH$p"
done
curl -sS "$HASH" | grep -c 'og:title'   # 期望 ≥ 1 (目前 trae 重构版是 0)
curl -sS "$HASH/robots.txt" | grep -c "content signal"  # 期望 0

# === 备份 ===
cp -a /www/wwwroot/le.imoons.cn /www/wwwroot/le.imoons.cn.bak-$(date +%Y%m%d)
```

---

## 12. 已知限制 & 改进方向

1. **OG / Twitter Card meta 缺失** — trae 重构版 BaseLayout 16255B 没 OG meta, 社交分享卡片失效. 修法: 加 9 个 Props + 31 行 head meta 块 (我们之前 SEO commit 那套).
2. **CF Page Cache 缓存老 HTML** — `Age: 10000+` 持续 2-3h, 强制 clear cache: CF Dashboard → Pages → blog-imoons → 部署 → "..." → Clear cache.
3. **`blog-imoons.pages.dev` robots.txt 是 CF 默认** — 自定义域 `blog.leeeo.cn/robots.txt` 是我们的 (167B), 默认子域返 1248B CF content signals. 修法: 改用 `src/pages/robots.txt.ts` endpoint 路由 (实测稳定覆盖).
4. **dev mode `markdown.remarkPlugins` deprecation warning** — Astro 7 默认 Sätteri 处理器, `rehypePlugins` 配置触发 warning. Astro 8 升级时要换 `unified({...})` API.
5. **`@astrojs/markdown-remark` 必装** — Astro 7 默认不再 bundled, 装在 package.json 持久化 (别 `--no-save`).
6. **Giscus App 必须用户 OAuth** — https://github.com/apps/giscus 装到 blog-comments repo, 硬限制无法程序化绕过.

---

## 附录: 文件清单

| 路径 | 用途 |
|---|---|
| `src/content.config.ts` | Zod schema (title/description/pubDate/category/tags/draft) |
| `astro.config.mjs` | `site: https://le.imoons.cn` + rehypePlugins 链 |
| `src/layouts/BaseLayout.astro` | 含 `wide` prop 双模式 max-width |
| `src/pages/rss.xml.ts` | RSS 2.0 feed endpoint |
| `src/pages/sitemap-index.xml.ts` | sitemap endpoint |
| `public/robots.txt` | 静态 robots.txt |
| `public/_redirects` | CF Pages 404 fallback |
| `scripts/remark-demote-h1.mjs` | rehype 插件, h1 demote h2 + class |
| `scripts/archive-article.sh` | 4 步强校验归档脚本 |
| `scripts/to_slug.py` | 中文标题转拼音 slug |
| `scripts/generate-search-index.mjs` | predev/prebuild 钩子, 生成 search.json |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署 |
| `/www/server/panel/vhost/nginx/le.imoons.cn.conf` | nginx 反代配置 |
| `/www/server/panel/vhost/cert/le.imoons.cn/{fullchain,privkey}.pem` | ZeroSSL ECC 证书 |
| `https://blog.leeeo.cn` / `https://blog-imoons.pages.dev` | CF Pages 线上 |
