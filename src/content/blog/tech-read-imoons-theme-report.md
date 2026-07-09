---
title: "read.imoons.cn 主题调研报告: 从 wp-content/themes 目录看子主题开发机会"
description: "对 read.imoons.cn 当前激活主题的结构、CSS 现状、模板层级、钩子系统做完整调研, 为后续开发'暗黑极客风'子主题做技术准备。"
pubDate: 2026-06-09
category: tech
subcategory: "项目实战"
tags: ["WordPress", "主题开发", "调研", "read.imoons.cn", "CSS"]
draft: false
---

# read.imoons.cn 主题调研报告
**日期**: 2026-06-09
**调研人**: Hermes Agent (subagent)
**目标**: 为后续开发「暗黑极客风」子主题做准备
**操作**: 仅调研，未改动任何文件

---

## ⚠️ 关键发现（先看这个）

1. **当前激活的主题不是 `imoons-future`，而是 `imoons-future.bak-20260608-152439`**（一个 .bak 后缀的目录）。`wp option get template/stylesheet` 都返回这个 bak 目录。
2. **两个目录的 `style.css` 都缺少 WordPress 标准主题头**（没有 `Theme Name:` / `Template:` / `License:` 等元信息）。这意味着**不能直接用经典子主题继承**（child theme `Template: imoons-future` 机制失效）。
3. **`functions.php` 里 `wp_enqueue_script('imoons-future-main', .../assets/js/main.js, ...)`，但 `assets/js/` 目录不存在**——`/wp-content/themes/imoons-future.bak-20260608-152439/assets/js/main.js` 实际返回 404。
4. **MEMORY 中提到的「温暖创业风/墨绿+暖橙+金黄」配色在当前激活主题里**完全看不到——实际是 Buer 风格蓝色系（`--ts-accent: #0B6FE8`），无任何暖色变量。**MEMORY 与实际不符**。
5. **single.php 没有调用 `comments_template()` 或 `comment_form()`**——尽管 `default_comment_status` 是 `open`，文章详情页**根本不渲染评论**。
6. 站点只有 1 个评论（imoonr 留言）、109 篇文章、6 个 page，无文章热度排序。
7. 主题已为新 TOC 功能开发过（`pre-toc-20260608-161833` 草稿目录存在），但**当前激活版本里没合并**。

---

## === 服务器环境 ===

- 域名/IP: `read.imoons.cn` / `43.139.124.235`（Debian 6.1.0-41-amd64, Nginx）
- WordPress 版本: **7.0**（`wp core version` 输出）
- PHP 版本: **8.0.26** (cli, NTS)
- MySQL 版本: **5.7.44-log**（从 `SHOW VARIABLES` 推断，非 wp-config）
- 主题目录: `/www/wwwroot/read.imoons.cn/wp-content/themes/`
- 主题文件名: `imoons-future.bak-20260608-152439/`（当前激活，文件结构见下）
- 父主题（如有）: **无**（既无 `Template:` 头，也没用 child theme 机制）
- 启用的插件列表: **仅 1 个** —— `hello.php` (v1.7.2, Hello Dolly 风格)
- 数据库名: `read_imoons_cn`（前缀 `wp_`）
- 站点标题: `不二的轻创业笔记`
- 站点描述: `分享互联网最新可执行的副业项目、轻创业思路、赚钱方法`
- 文章数: 109 已发布
- 页面数: 6 已发布
- 评论数: 1（来自 post 25，author=imoonr，approved=1）

---

## === 主题结构 ===

**当前激活主题** `imoons-future.bak-20260608-152439/`（剔除 .bak 备份文件）：

```
imoons-future.bak-20260608-152439/
├── assets/
│   └── img/
│       └── default-cover.png      ← 文章无图时的占位
├── footer.php                      (35 行)
├── functions.php                   (67 行)
├── header.php                      (132 行)
├── index.php                       (196 行)
├── page.php                        (22 行)
├── single.php                      (37 行)
├── style.css                       (745 行, ~24KB)
└── (.bak 备份若干)
```

**注意**：`assets/js/` 目录**不存在**！functions.php 引用了 `main.js`，会 404。

**对比同位置的 `imoons-future/` 目录**（非激活，version 3.1.0）：
- 多了 TOC（目录）功能：`imoons_extract_toc()`、`imoons_render_toc_outside()`、`imoons_toc_scroll_spy()`
- 多了赛博朋克光标追踪、Typewriter 打字机
- 但**同样** `style.css` 缺标准主题头，无法作为子主题父级
- 里面有 `pre-toc-20260608-161833/` 草稿子目录（49416 字节的 style.css）

**themes/ 下其他目录**（都是历史/废弃主题，inactive）：
- imoons-blog、imoons-clean、imoons-clean-broken-2228、imoons-koan、imoons-tutorial、mooyan-blog-theme、qui_pure2.75

---

## === 关键文件分析 ===

### style.css（行 1-30, 当前激活）
```css
/* ============================================
   imoons-future → Buer 风格（read.imoons.cn）
   移植自 blog.imoons.cn Buer 主题
   Version: 3.0.0
   ============================================ */
```
**⚠️ 没有 WordPress 主题元信息头**（没有 `Theme Name` / `Template` / `License` / `Text Domain`）。WP 仍能识别它是因为 `wp-content/themes/` 下的目录 + 有 `index.php`。

### functions.php（67 行）
- `add_theme_support("title-tag" | "post-thumbnails" | "automatic-feed-links")`
- `wp_enqueue_style("imoons-future-style", get_stylesheet_uri(), array(), "3.0.7")`
- `wp_enqueue_script('imoons-future-main', get_template_directory_uri() . '/assets/js/main.js', ...)` ⚠️ **404**
- 移除 emoji 脚本
- `imoons_cyberpunk_assets()` — wp_footer 钩子输出内联 JS（glitch / 淡入 / 卡片延迟）
- `imoOns_get_views($post_id)` / `imoOns_set_views()` — 自定义 `views` post meta 计数器（**不是 wp-postviews 插件**，是手写的）
- **没有** register_nav_menu、register_sidebar、add_image_size、自定义字段（custom field/meta box）

### header.php（132 行）
- 顶部 PHP 拉取前 5 个分类（按文章数倒序，排除 term_id=1）
- `<!DOCTYPE html>` + `language_attributes()`
- `wp_head()` 钩子正常
- `<body <?php body_class(); ?>>` + `wp_body_open()`
- **导航栏**（`.ts-nav` 固定顶部）：logo + 动态分类菜单 + 搜索按钮 + 主题切换按钮 + 移动端汉堡按钮
- **搜索浮层**（`.ts-search-overlay`）+ 搜索表单
- **内联 JS**（重要）：
  - 主题恢复：`localStorage.getItem("ts-theme")` → 设置 `html[data-theme]`
  - 默认暗色（`prefers-color-scheme: light` 才亮）
  - 主题切换按钮：写 `localStorage` + 切 `data-theme`
  - 移动端菜单 toggle
  - 搜索浮层开关
  - 错峰淡入（`ts-anim` → `ts-visible`）

### footer.php（35 行）
- 三列：博客名+描述、分类链接、订阅（RSS/评论RSS/站点地图）
- 底部版权：`© {年} {博客名} · 由 WordPress 驱动`
- **正常** `wp_footer()` 钩子
- ⚠️ **没有任何** wp_footer 钩子之外的统计/分析代码

### index.php（196 行）
- 首页 hero 区（is_home && !is_paged 时显示）
- 自定义查询：拉所有已发布文章 → 置顶在前 → 每页 12 篇分页
- 标签云（首页首屏）`get_tags(orderby=count, limit=40)`
- 文章卡片网格：缩略图、分类徽章、标题、摘要、日期、阅读数
- `paginate_links()` 分页

### single.php（37 行）
- 文章封面（`has_post_thumbnail`）
- 分类徽章 + 标题 + 元信息（日期 + 阅读数 + 修改时间）
- `the_content()` + `wp_link_pages()`
- **没有** `comments_template()` → 评论**不显示**
- **没有** 上一篇/下一篇导航
- **没有** 分享按钮
- **没有** 相关文章推荐

### page.php（22 行）
- 极简：标题 + 封面 + 正文。无侧栏、无评论。

### 模板层级
- **没有** `page-xxx.php` / `single-xxx.php` / `category-xxx.php` / `tag-xxx.php`
- **没有** `archive.php`（用 `index.php` fallback）
- **没有** `search.php`（用 `index.php` fallback）
- **没有** `404.php`（用 `index.php` fallback → WP 实际上会用 `wp-includes/theme-compat/legacy.php`，因为缺 404）
- **没有** `sidebar.php`
- **没有** `front-page.php`
- 模板文件总数: 5 个 (`header/footer/index/single/page`) + style.css + functions.php

---

## === CSS 现状 ===

### 主题色变量定义在哪
- `style.css` 第 7-74 行（`:root` 块 + `[data-theme="dark"]` 块，第 78-103 行）
- 全部以 `--ts-` 前缀的 CSS 变量

### 当前默认色（暗还是亮）
- **暗色为默认**（`header.php` JS 逻辑：未保存时，若系统是 `prefers-color-scheme: light` 才用亮，否则暗）
- 暗色 palette：
  - `--ts-accent: #3A8FF0`（亮蓝，主色）
  - `--ts-accent-2: #2B7EE0`
  - `--ts-accent-light: #60A5FA`
  - `--ts-bg: #0C0E12`（背景近黑）
  - `--ts-bg-2: #131519` / `--ts-bg-3: #1B1E24` / `--ts-bg-4: #23272F`
  - `--ts-text: #EAEDF3` / `--ts-text-2: #9098A8` / `--ts-text-3: #5E6878`
  - `--ts-border: rgba(255,255,255,.07)`
  - `--ts-shadow`: 一组 0,0,0,0.30-0.54 透明度的 box-shadow
- 亮色 palette（`[data-theme="light"]` / `:root`）：
  - `--ts-accent: #0B6FE8`（主蓝）
  - `--ts-accent-2: #0860CC`
  - `--ts-bg: #FFFFFF` / `--ts-bg-2: #F7F8FA` / `--ts-bg-3: #EFF1F5`
  - `--ts-text: #0D1117`

### 深浅色切换机制
- **触发**：导航栏 `#tsThemeToggle` 按钮（太阳/月亮 SVG）
- **存储**：`localStorage.setItem("ts-theme", "dark"|"light")`
- **应用**：`<html data-theme="...">` 属性
- **CSS**：`[data-theme="dark"] { ... }` 块（行 78-103）覆盖变量
- **过渡动画**：`.ts-theme-switching` 类（300ms 平滑过渡），切换完 320ms 后移除
- ⚠️ **没有** cookie 持久化（用 localStorage），不影响服务端

### 主色 + 辅色 + 背景色具体值
| 角色 | 暗色 | 亮色 |
|---|---|---|
| 主色 accent | `#3A8FF0` | `#0B6FE8` |
| 主色 hover | `#2B7EE0` | `#0860CC` |
| 辅色 teal | `#00B09B` / `#00C9A7` | 同上 |
| 辅色 green | `#059669` | 同上 |
| 辅色 amber | `#D97706` | 同上 |
| 辅色 rose | `#E11D48` | 同上 |
| 背景主 | `#0C0E12` | `#FFFFFF` |
| 背景卡片 | `#131519` | `#F7F8FA` |
| 背景二级 | `#1B1E24` | `#EFF1F5` |
| 文字主 | `#EAEDF3` | `#0D1117` |
| 文字次 | `#9098A8` | `#444D5A` |
| 边框 | `rgba(255,255,255,.07)` | `rgba(13,17,23,.08)` |

**对比 MEMORY 提到的「墨绿+暖橙+金黄」** → 实际代码里**完全没有墨绿/暖橙/金黄作为主色**。`--ts-amber #D97706` 是辅助色，**不是主题主色**。建议更新 MEMORY。

### 字体引入方式
- **全部本地** system font stack，无 Google Fonts、无 CDN
- 正文：`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
- 等宽：`"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace`

### 响应式断点
在 `style.css` 行 661-744：
- `@media (max-width: 860px)` — 移动端菜单显示汉堡
- `@media (max-width: 768px)` — Hero/容器/卡片网格/文章 body
- `@media (max-width: 720px)` — Footer 单列
- `@media (max-width: 480px)` — 小屏（导航 56px，文章 padding 压缩）
- `@media (hover: none)` — 触屏禁用 hover 抬起
- 容器最大宽度 `--ts-max-w: 1120px`，文章宽度 `--ts-narrow-w: 740px`

---

## === 文章详情页功能 ===

- **文章页用了哪些模板**: `single.php`（唯一）
- **阅读量统计**: **手写 `views` post meta**（非 wp-postviews 插件）
  - 读取：`imoOns_get_views($post_id)` → `get_post_meta($post_id, "views", true)`
  - 写入：`wp_head` 钩子 `imoOns_set_views()`，每次访问自增 1
  - 数据库验证：post 2 已有 2343 次阅读、post 65 有 423 次
- **评论系统**: **没有**（`default_comment_status=open` 但 single.php 不调 `comments_template()`）
- **分享按钮**: **没有**
- **相关文章推荐**: **没有**
- **TOC 目录**: **没有**（当前激活版本），但 inactive 的 `imoons-future` 已实现（`imoons_extract_toc` 等函数）
- **代码高亮**: **没有**（文章里 `<pre><code>` 没有额外高亮处理）
- **上一篇/下一篇**: **没有**（inactive 版本已实现 `ts-prev-next`）

---

## === 子主题建议 ===

### 建议子主题目录名
**推荐 `imoons-future-dev`**（不直接叫 imoons-dark，先做开发版方便调试）

### 必需文件清单
1. `style.css` — **必须**含完整 WP 主题头：
   ```css
   /*
   Theme Name: imoons-future-dev
   Template: imoons-future.bak-20260608-152439   ← 注意是激活的目录名
   Description: 暗黑极客风变体
   Version: 0.1.0
   */
   ```
2. `screenshot.png` — 1200×900 预览
3. `functions.php` — `<?php // 静默继承父主题 ?>`（空文件）
4. **可选** 模板覆盖：
   - `header.php` — 想换 JS 注入逻辑 / 切 theme toggle 行为
   - `index.php` — 改首页 hero / 卡片
   - `single.php` — 改文章页 + 加 TOC + 加 prev/next
   - `style.css` — 重写 `:root` 变量 + `[data-theme="dark"]` 变量

### 父主题继承机制验证
- ⚠️ **子主题继承依赖 `style.css` 顶部的 `Template: xxx` 头**
- **当前激活主题的 `style.css` 完全没有标准 WP 头**（没有 Theme Name / Template / License）
- WP 仍然识别它作为主题，是**靠目录里有 `index.php`**，不是靠元信息
- **风险**：子主题写 `Template: imoons-future.bak-20260608-152439` 时，WP 会查这个目录的 `style.css` 顶部 `Theme Name` 字段匹配。**匹配失败 → 子主题无法激活**。
- **解决方案**（任选）：
  - A) 先**修复激活主题的 style.css**（加标准头），再写子主题 —— 但任务禁止改文件
  - B) 改**用其他有标准头的主题**（如 `mooyan-blog-theme` 有完整头）作 `Template` —— 但语义错乱
  - C) **绕开 child theme**，直接复制激活目录成 `imoons-future-dev/`，自己改 style.css —— 最直接
  - D) 把 **inactive 的 `imoons-future` 目录**修复 style.css 头（已存在现成代码），激活它，然后再写标准子主题 → 但需要确认不动文件

### 风险评估（CSS 变量重定义可能出问题的地方）
1. **JS 钩子重复绑定**：`header.php` 的内联 JS 在主题切换时绑定滚动监听 / 菜单 toggle / 搜索浮层——子主题若再写一份 `wp_footer` 内联 JS 会重复触发。
2. **`assets/js/main.js` 404**：父 functions.php enqueue 一个不存在文件，子主题要意识到这个 404 是否阻塞功能验证。
3. **localStorage key 冲突**：父用 `ts-theme`、子主题改用 `imoons-dark-theme` 即可。
4. **`data-theme="dark"` 选择器特异性**：子主题改 `:root` 会被父的 `[data-theme="dark"]` 块覆盖（特异性 [0,1,0] vs [0,1,0]，后者顺序在后）→ 子主题**应改 `[data-theme="dark"]`** 而非 `:root`。
5. **评论/TOC/分享**：父没有，子主题添加是**净增**而非覆盖，但需要自己写 `single.php` 模板（覆盖）。
6. **分类 term_id=1 是「未分类」**：父代码用 `array_filter(... $cat->term_id != 1)` 硬编码硬过滤，子主题改这块要小心。
7. **`imoOns_get_views` / `imoOns_set_views` 函数名**：子主题若重复声明会 fatal error。**保持父函数不动**。
8. **视图计数在 `wp_head` 钩子触发**：意味着浏览器 cache / 爬虫每次都 +1，是已知的设计缺陷（与本次任务无关，但需注意）。

---

## === 重要发现 ===

### 🚨 必须先解决的拦路虎
1. **激活主题的 style.css 无 WP 标准头** → 子主题 `Template: xxx` 继承机制会失效。需要在子主题 `style.css` 里写 `Template: imoons-future.bak-20260608-152439` 试一下是否被 WP 接受；如果不接受，建议**先修复父主题的 style.css 头**（加 `Theme Name` / `License` / `Text Domain` 等，**只加头不动其他内容**），或者改用方案 C（直接复制）。

2. **MEMORY 与实际配色不符**：
   - MEMORY 说：「墨绿+暖橙+金黄，温暖创业风」
   - 实际：`#0B6FE8` 蓝、`#00B09B` 青绿、`#D97706` 琥珀（仅辅助色）
   - 没有墨绿主色（`#059669` 绿色只是辅助之一）
   - 建议在动手前先**更新 MEMORY** 或与用户确认是要「在现有蓝色基础上叠加暖色重设计」还是「完全推翻做暗黑极客」

3. **`assets/js/main.js` 404** 是个**已知 bug**（不算阻塞，但浏览器 devtools 会一直报警）。

### 🟡 站点状态
- 109 篇文章已发布，6 个 page
- 仅 1 条评论（很可能站长期望评论是关的）
- 热度榜前 3：post 2 (2343 views)、post 65 (423)、post 41 (403)
- 站点使用 Nginx（无 Apache）
- 没有 Akismet、没有 wp-postviews、没有 wp-statistics、没有 wpDiscuz（确认了）

### 🟢 对「暗黑极客风」有利的基础
- 主题**已经是 Buer 极简风**（接近 Geist / Linear 风格），蓝主色 + 近黑背景
- 已经有 `data-theme` 切换机制，可直接复用做「暗 + 极客」二合一
- 字体用 system stack → 子主题可加 JetBrains Mono / Fira Code 而不冲突
- CSS 变量已全覆盖颜色/阴影/圆角/间距 → 重写变量即可换色

### 🔧 跟 child theme 无关的扩展点
- 想加 TOC → inactive 版的 `imoons_extract_toc()` 函数可直接 copy
- 想加 prev/next → inactive 版的 `ts-prev-next` 块可直接 copy
- 想加评论 → 在 `single.php` 加 `comments_template()` 一行
- 想加代码高亮 → enqueue Prism.js / highlight.js，CSS 用 `[data-theme]` 适配

### 父主题可继承清单
- `header.php`（132 行）— 完整可用
- `footer.php`（35 行）— 完整可用
- `index.php`（196 行）— 完整可用
- `page.php`（22 行）— 完整可用
- `style.css`（745 行）— 变量定义完整
- `functions.php`（67 行）— 4 个函数全可调用

### 子主题不需要重写的部分
- 导航 HTML 结构（除非想改）
- 文章卡片的 HTML
- 分类过滤逻辑
- 视图计数（保留 `views` post meta）

---

## === 调研耗时 ===
**12 分钟**（SSH 登录 + 20+ 次远程命令 + 文件读取 + 报告撰写）

---

**生成者**: Hermes Agent subagent
**完成时间**: 2026-06-09 10:14 CST
**未修改任何文件 / 数据库 / 服务**
