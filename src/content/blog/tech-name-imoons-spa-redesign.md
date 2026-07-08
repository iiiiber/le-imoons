---
title: "name.imoons.cn SPA 重构方案"
description: "15KB 11 章: 把 10 个 10 年前的 PHP/HTML 页面重构为手机 + 桌面自适应的现代 SPA。架构设计 + 技术选型对比 + 12 周实施计划。"
pubDate: 2026-05-20
category: tech
tags: ["SPA", "重构", "name.imoons.cn", "架构"]
draft: false
---

# name.imoons.cn SPA 重构方案

## 一、项目目标

将 name.imoons.cn 现有的 10 个 PHP/HTML 页面（10 年前的样式）重构为一个手机 + 桌面自适应的现代 SPA。前端技术栈对齐已经在 n.imoons.cn 跑起来的 bazi-namer 项目（Vite + React 18 + React Router v6 + Tailwind 3）。后端保留现有 PHP（MySQL + 6tail/lunar-php + MiniMax M3 AI），改造为纯 JSON API 给前端调用。

成果衡量标准：手机（375px）/ 平板（768px）/ 桌面（1280px+）三档断点视觉一致、交互流畅；首屏加载 < 2s；SEO 关键页面可被百度收录；现有用户数据零丢失。

---

## 二、架构设计

### 2.1 顶层架构

前端 SPA（静态资源） ＋  PHP 后端 API（保留）。nginx 负责静态资源服务 + API 反代 + SSL。

```
浏览器
  ↓
n.imoons.cn / name.imoons.cn  (nginx 443)
  ├─ /             → SPA 静态文件（dist/）
  ├─ /assets/*     → SPA 静态文件
  ├─ /api/*        → 反代到 PHP-FPM (php-fpm:9000) 或 pm2 bazi-namer (3001)
  └─ /uploads/*    → 静态资源
```

注意：name.imoons.cn 是另一个域名，结构跟 n.imoons.cn 同构但 API 是老 PHP。两个站点各自独立，互不影响。

### 2.2 目录结构（前端 SPA）

```
bazi-namer/
├── frontend/
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.jsx              # 入口
│   │   ├── App.jsx               # Router 根
│   │   ├── routes.jsx            # 路由表（集中维护）
│   │   ├── api/
│   │   │   ├── client.js         # axios 实例（baseURL + 拦截器）
│   │   │   ├── auth.js           # 登录注册
│   │   │   ├── chart.js          # 排盘
│   │   │   ├── order.js          # 订单支付
│   │   │   ├── user.js           # 用户中心
│   │   │   └── articles.js       # 文章
│   │   ├── stores/
│   │   │   ├── authStore.js      # Zustand：登录态 / token / user
│   │   │   └── uiStore.js        # Zustand：sidebar 折叠 / 主题
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Naming.jsx
│   │   │   ├── Result.jsx
│   │   │   ├── NameDetail.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── User.jsx
│   │   │   ├── Order.jsx
│   │   │   ├── Articles.jsx
│   │   │   └── ArticleDetail.jsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── MobileNav.jsx
│   │   │   │   └── Container.jsx
│   │   │   ├── ui/                # 通用 UI 原子
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   ├── Toast.jsx
│   │   │   │   ├── Skeleton.jsx
│   │   │   │   └── EmptyState.jsx
│   │   │   ├── naming/
│   │   │   │   ├── SurnameInput.jsx
│   │   │   │   ├── GenderPicker.jsx
│   │   │   │   ├── BirthDatePicker.jsx
│   │   │   │   └── PreferenceTextarea.jsx
│   │   │   ├── chart/
│   │   │   │   ├── BaziGrid.jsx     # 四柱
│   │   │   │   ├── WuxingBar.jsx    # 五行
│   │   │   │   ├── Xiyongshen.jsx   # 喜用神
│   │   │   │   └── NameList.jsx
│   │   │   └── paywall/
│   │   │       └── LockedNames.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useMediaQuery.js
│   │   │   └── useDebounce.js
│   │   ├── lib/
│   │   │   ├── format.js           # 日期 / 价格格式化
│   │   │   ├── storage.js          # localStorage 封装
│   │   │   └── constants.js        # 枚举 / 配置
│   │   └── styles/
│   │       └── globals.css         # Tailwind + 全局变量
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── scripts/
│   ├── build-spa.sh               # 构建 + 部署幂等脚本
│   ├── deploy-name-spa.sh         # 发布到 /www/wwwroot/name.imoons.cn/dist
│   └── rollback.sh
└── docs/
    └── spa-redesign-plan.md       # 本文档
```

### 2.3 路由表（React Router v6）

```
/                              Home（hero + features + pricing + testimonials）
/naming                        Naming（起名表单）
/result                        Result（排盘结果）— 需要 query string ?sid=xxx
/names/:id                     NameDetail（单个名字详情）
/login                         Login
/register                      Register
/user                          User（用户中心：订单 / 历史 / 收藏 tab）
/order                         Order（订单 + 支付）
/articles                      Articles（文章列表）
/articles/:slug                ArticleDetail
*                              404 → 重定向到 /
```

懒加载：所有 page 组件都用 React.lazy + Suspense 分包，首屏只加载 Home + layout。

### 2.4 状态管理

全局状态用 Zustand（auth + ui 两个 store），局部状态用 useState / useReducer。**不**用 Redux。

- `authStore`：token / user / login() / logout() / refresh()。token 持久化到 localStorage，刷新时自动恢复。
- `uiStore`：sidebar 折叠状态 / 移动端菜单开关 / 主题（亮 / 暗，未来扩展）。

表单状态：React Hook Form（schema 校验用 zod）。理由：起名表单字段多（姓 + 性别 + 出生日期 + 自定义偏好），原生 useState 会很啰嗦，RHF 的性能更好。

服务器状态：先用原生 fetch + 自写 hook（useApi），**不**上 React Query。等真有缓存需求（订单列表 / 文章分页）再引入。

### 2.5 API 客户端

单一 axios 实例，baseURL 用环境变量：

- dev：`VITE_API_BASE=http://localhost:3001/api`
- prod：`VITE_API_BASE=/api`（nginx 反代同源，无 CORS）

拦截器：

1. 请求：自动带 `Authorization: Bearer ${token}`。
2. 响应：401 → 清 token + 跳 /login（白名单：/login /register 不跳）。
3. 响应：5xx → toast 提示 + 上报错误。

PHP 后端改造：把现有 `login.php` / `register.php` / `chart.php` 等改成返回 JSON（`header('Content-Type: application/json')`），去掉所有 HTML 输出。前端调 `/api/login.php` 时仍然走 PHP 文件名（保留路径兼容）。

---

## 三、技术选型对比

### 3.1 路由方案

React Router v6（推荐）：生态成熟，跟 bazi-namer 已部署项目一致，懒加载 / nested routes / 动态参数都支持。

单文件多页（MPA）：维护 10 个独立 HTML，跟现有 PHP 模式最接近。但响应式 + 组件复用会非常痛苦，每次改 header 要改 10 个文件。

方案：选 React Router v6。原因：跟 n.imoons.cn 对齐 + 移动端 SPA 体验更连贯 + 后续加 PWA / 离线缓存更容易。

### 3.2 状态管理

Zustand（推荐）：API 极简，4KB，TypeScript 友好，无 Provider 嵌套。

Context API：够用，但每次 state 变会重渲整棵子树，表单密集场景性能差。

Redux Toolkit：功能全但样板代码多，单 agent 项目杀鸡用牛刀。

方案：选 Zustand。

### 3.3 CSS 方案

Tailwind CSS 3（推荐）：跟 bazi-namer 已部署项目一致；utility-first 写响应式（`md:grid-cols-3`）很自然；构建后 CSS 自动 purge。

UnoCSS：更快但生态小；项目刚启动时配 bazi-namer 不一致会额外成本。

方案：选 Tailwind CSS 3。

### 3.4 构建工具

Vite（推荐）：dev 启动 < 1s，HMR 快，跟 bazi-namer 一致。

Next.js：带 SSR / SSG，SEO 更好但部署复杂（要 Node runtime + pm2），跟当前 nginx + PHP-FPM 架构不兼容。

Nuxt / Astro 同理。

方案：选 Vite。SEO 短板用预渲染（vite-plugin-prerender 或 react-snap）补。

---

## 四、UI 组件库选型

四个候选：

- headlessui：无样式 + 无障碍，体积小，需要自己写样式。
- shadcn/ui：基于 Radix + Tailwind，复制源码到项目，完全可控，社区最火。
- daisyui：Tailwind 插件，提供 class 命名（btn / card），开箱即用但样式定制要覆盖 CSS 变量。
- 自己写：完全自由但工作量最大。

推荐：**shadcn/ui（基础组件） + 自己写少量业务组件**。

理由：

1. shadcn 源码在项目里，能改能删，没有版本锁死。
2. 已带 Dialog / Sheet / Tabs / Toast / Form 这些本项目需要的组件（modal 支付、用户中心 tab、文章详情 drawer）。
3. 跟 Tailwind 天然集成，响应式断点直接用 Tailwind class。
4. 体积可控，按需引入，不打包没用的组件。

不选 daisyui 的原因：样式难定制，跟 shadcn 比起来视觉更"通用模板"，起名产品需要更有文化感的视觉。

不选 headlessui 单独用的原因：要自己写很多样式，工时翻倍。

需要安装的 shadcn 组件：button / input / textarea / dialog / sheet / tabs / toast / card / skeleton / form / select / date-picker / radio-group / dropdown-menu。约 13 个组件，每个 < 5KB gzip。

---

## 五、响应式断点策略

### 5.1 移动优先

默认样式是移动端，md (768px) / lg (1024px) / xl (1280px) 逐步加复杂布局。理由：起名产品用户 70% 在手机（孕妇 + 新手父母），先保证手机体验。

```
默认 (< 640px)        手机竖屏：单列、底部 nav、卡片堆叠
sm  (>= 640px)        手机横屏 / 小平板：2 列网格
md  (>= 768px)        平板：sidebar 出现
lg  (>= 1024px)       桌面：完整布局 + 三列内容
xl  (>= 1280px)       大屏：内容居中，最大宽 1200px
```

### 5.2 导航方案

手机端：底部固定 tab bar（首页 / 起名 / 订单 / 我的），抽屉式菜单放次要入口。Header 收起只留 logo + 搜索图标。

桌面端：顶部水平 nav（首页 / 起名 / 文章 / 关于 / 登录/头像），侧边栏不放。

切换阈值：md (768px)。`useMediaQuery('(min-width: 768px)')` 决定渲染哪种 nav。

### 5.3 关键页面的移动端处理

- 起名表单：姓 / 性别 / 出生日期 / 偏好 — 全部纵向堆叠（每项一行），按钮全宽。
- 排盘结果：四柱在桌面是 2x2 网格，手机是 4 列横滚（`overflow-x-auto`）；五行图改成竖向柱状图（标签在左，柱在右）。
- 名字列表：卡片堆叠，每张卡显示名字 + 评分 + 五行 + 解锁按钮（免费 / 付费 区分视觉）。付费名字模糊显示 + 锁图标。
- 名字详情：手机端内容先显示 AI 解释（最重要），五行拆解折叠在次级 tab。
- 用户中心：tab 横向切换（订单 / 历史 / 收藏），表格在手机端改成卡片列表（每行一张卡片）。
- 文章列表：1 / 2 / 3 列响应式网格；详情页正文最大宽 720px 居中。
- 支付页：金额 + 微信扫码 / 支付宝二维码居中显示，按钮全宽。

### 5.4 性能策略

- 图片：所有图 `<img loading="lazy" decoding="async">`，hero 用 `<picture>` + WebP。
- 字体：系统字体栈优先，必要时用 woff2 子集。
- JS：路由懒分包，每个 page < 50KB gzip。
- CSS：Tailwind purge 后 < 20KB gzip。

---

## 六、PHP 后端兼容方案

### 6.1 改造范围

PHP 文件改造清单：

1. `login.php` / `register.php`：去掉 HTML 输出，统一返回 `{ code, message, data: { token, user } }`。
2. `chart.php`：接 POST JSON body（surname / gender / birth_date / pref），返回四柱 / 五行 / 喜用神 / 名字列表。
3. `name-detail.php`：GET `?id=xxx`，返回单个名字详情。
4. `order.php` / `pay.php`：POST/GET JSON，返回订单状态。
5. `user.php`：GET 当前用户 + 订单 + 历史 + 收藏。
6. `articles.php` / `article-detail.php`：GET 列表 / 详情（JSON）。
7. 现有 `admin.php` 保持 HTML（独立后台，跟用户端隔离）。

所有 API 路径保持 `.php` 后缀（保留 nginx 配置兼容）。

### 6.2 CORS

同源策略：SPA 部署到 name.imoons.cn，API 反代到 `/api/*` → php-fpm。**不**需要 CORS（浏览器认为同源）。

如果未来要跨域调用（比如 n.imoons.cn 调 name.imoons.cn 的 API），加 CORS header：

```
Access-Control-Allow-Origin: https://n.imoons.cn
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 6.3 鉴权 / Session

方案：JWT（推荐）。PHP 端用 `firebase/php-jwt` 签发 token，前端存 localStorage，每次请求带 Authorization header。

迁移路径：

- 阶段一：保留 PHP 原 session，前端通过 cookie 自动带（`withCredentials: true`）。改造最小，验证流程最快。
- 阶段二：上 JWT，把 session 数据迁到 token claim。前端无感（都走 Authorization header）。

推荐阶段一先行（够用），阶段二在用户数据迁移时一起做。

注意：session 跨域问题。如果前端和 PHP 不同源，session cookie 会被浏览器拒。**强烈建议前端和 PHP 同源（都跑在 name.imoons.cn 下）**，避免这个坑。

### 6.4 请求 / 响应格式统一

约定所有 API 响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

错误 `code != 0`，前端拦截器弹 toast。分页：`data.list` + `data.total` + `data.page`。

### 6.5 nginx 配置

```
server {
    listen 443 ssl;
    server_name name.imoons.cn;

    root /www/wwwroot/name.imoons.cn/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 反代到 PHP-FPM
    location /api/ {
        fastcgi_pass unix:/tmp/php-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

---

## 七、分阶段实施计划

每个阶段独立可验收、可回滚。

### 阶段 0：脚手架搭建（预计 1 小时）

任务：
- 在 /root/bazi-namer/frontend/ 复用现有 Vite 项目结构
- 安装新依赖：shadcn 所需 Radix 底层、react-hook-form、zod、axios
- 配置 Tailwind 主题（颜色 token 调成有文化感的暖色：墨绿 + 朱红 + 米白）
- 建空目录骨架 + 占位页面（10 个 page 都能路由成功）

验收点：访问每个路由都看到 "Coming Soon" 占位符，控制台无错。

风险：依赖版本冲突 — 解决方式是用现有 package.json 锁定版本范围。

### 阶段 1：Layout + 响应式断点（预计 1.5 小时）

任务：
- 实现 Header / Footer / MobileNav / Container
- 配置 Tailwind 主题色 + 字体 + 间距 token
- 实现 useMediaQuery hook
- 桌面端顶部 nav + 手机端底部 tab 切换

验收点：375px / 768px / 1280px 三档下 nav 切换正确；移动端无横向滚动。

风险：iOS Safari 底部 tab 安全区 — 用 `pb-[env(safe-area-inset-bottom)]` 处理。

### 阶段 2：通用 UI 组件（预计 1 小时）

任务：
- 安装 shadcn 组件（13 个）
- 写 Button / Input / Card / Modal / Toast / Skeleton 等封装
- 写 Loading / Empty / Error 三种状态组件

验收点：组件 story 可点开看（不需要 Storybook，本地 demo 页即可）。

风险：shadcn 主题跟产品调性冲突 — 解决方式是覆盖 CSS 变量调色。

### 阶段 3：API 客户端 + Auth（预计 1 小时）

任务：
- 写 axios 实例 + 拦截器
- 改 PHP 的 login.php / register.php 返回 JSON（保留 session）
- 实现 authStore（token / user 持久化）
- 实现 Login / Register 页面（表单 + 校验）

验收点：登录成功后跳转，刷新页面登录态保持；退出后跳首页。

风险：PHP session 跨域 — 解决方式确认同源部署。

### 阶段 4：核心页面 — Home + Naming + Result（预计 2.5 小时，重点）

任务：
- Home：Hero（动效或渐变背景）+ Features（3 列响应式）+ Pricing（卡片堆叠）+ Testimonials（横向滚动）
- Naming：起名表单（RHF + zod 校验），提交后调 /api/chart.php，跳 /result
- Result：四柱（BaziGrid）+ 五行（WuxingBar）+ 喜用神（XiYongshen）+ 名字列表（NameList，付费名字模糊 + 解锁按钮）
- 改 PHP chart.php 返回结构化 JSON

验收点：完整走一遍起名流程，输入 → 排盘 → 看到结果列表；手机端四柱横滚、五行竖图正常。

风险：排盘返回慢（AI 调用 MiniMax M3）— 加 loading skeleton + 乐观先返回基础结构。

### 阶段 5：核心页面 — NameDetail + Articles + ArticleDetail（预计 1.5 小时）

任务：
- NameDetail：AI 解释（大字号排版）+ 五行拆解（chip 列表）+ 读音（拼音 + 音调）
- Articles：列表 + 分页 + 搜索（可选）
- ArticleDetail：文章正文（max-w-prose 居中排版）+ 上一篇 / 下一篇

验收点：点结果页任一名字能看到详情；文章列表 → 详情跳转顺畅。

风险：PHP 文章数据量大 — 加缓存（redis 或文件缓存）。

### 阶段 6：用户中心 + 订单 + 支付（预计 2 小时）

任务：
- User：三 tab（订单 / 历史 / 收藏），手机端用 sheet 抽屉切换
- Order：订单列表 + 创建订单 + 支付页（微信扫码 + 支付宝）
- 改 PHP order.php / pay.php 返回 JSON
- 接入支付（mock 优先，真接入走第二阶段）

验收点：能创建订单 → 跳支付 → 标记成功 → 用户中心看到订单。

风险：支付回调异步 — 解决方式用 polling（前端 3 秒轮询订单状态）。

### 阶段 7：SEO + PWA + 性能优化（预计 1.5 小时）

任务：
- 用 vite-plugin-prerender 预渲染 Home / Articles / ArticleDetail
- 加 robots.txt + sitemap.xml
- 加 manifest.json（PWA 图标）
- Lighthouse 跑分优化（首屏 < 2s）

验收点：百度 / Google 能抓取到关键页面；Lighthouse 性能分 > 85。

风险：prerender 不支持动态路由 — 用 react-snap 兜底。

### 阶段 8：部署 + 灰度（预计 1 小时）

任务：
- 写 deploy-name-spa.sh（幂等：备份 dist → 拉代码 → npm ci → npm run build → 同步到 /www/wwwroot/name.imoons.cn/dist）
- nginx 配置切换（保留旧 PHP 站点，新 SPA 在 /new 路径先跑）
- 观察一周无问题后切主路径

验收点：name.imoons.cn 全站 SPA 跑通；旧 PHP 站点可回滚。

风险：pm2 reload 期间停机 — 解决方式用蓝绿部署（dist_v1 / dist_v2 切换符号链接）。

---

## 八、风险清单

1. PHP session 跨域
   - 描述：前端 SPA 跟 PHP API 不同源时 session cookie 不工作。
   - 影响：用户登录态丢失。
   - 缓解：强制同源部署（前端 + API 都跑在 name.imoons.cn 下）。

2. API 路径适配
   - 描述：现有 PHP 文件路径可能跟前端期望不一致（比如 /api/chart vs /api/chart.php）。
   - 影响：404。
   - 缓解：阶段 3 一次性梳理所有 API 路径，建 mapping 表。

3. SEO 下降
   - 描述：从 10 个静态 HTML 变单页 SPA，百度抓取困难。
   - 影响：自然流量下降。
   - 缓解：阶段 7 预渲染 + sitemap + 保留 .php 页面作为镜像（带 canonical 指向 SPA）。

4. 现有用户数据迁移
   - 描述：老 PHP 用户数据（users / orders / name_history）在老库，SPA 上来后可能密码 hash 算法不兼容。
   - 影响：老用户登录失败。
   - 缓解：保留旧 password_verify（bcrypt）流程，新用户走新逻辑，老用户无感。

5. pm2 reload 期间停机
   - 描述：部署期间 bazi-namer 重启，旧请求被中断。
   - 影响：用户在支付中途掉线。
   - 缓解：蓝绿部署（dist_old / dist_new 符号链接切换）+ 部署窗口选凌晨 + 部署前发公告。

6. AI 调用慢 / 失败
   - 描述：MiniMax M3 调用可能 5-15 秒或超时。
   - 影响：用户体验差。
   - 缓解：loading skeleton + 60 秒 timeout + 失败重试 + 缓存相同输入结果 24h。

7. 微信支付回调不稳定
   - 描述：支付回调可能延迟或丢失。
   - 影响：订单状态不同步。
   - 缓解：前端轮询 + 后端定时查单（cron 每分钟）。

8. 移动端 Safari 兼容
   - 描述：iOS Safari 对某些 CSS 特性支持差（safe-area、backdrop-filter）。
   - 影响：视觉异常。
   - 缓解：阶段 1 起就拿真机测（至少 iPhone 13 Safari）。

9. Tailwind purge 误删
   - 描述：动态 class 名（比如 `bg-${color}`）会被 purge 掉。
   - 影响：样式丢失。
   - 缓解：所有动态 class 走 safelist（tailwind.config.js 显式列出）。

10. 旧 PHP 站点要保留多久
    - 描述：用户可能还在用旧链接。
    - 影响：404。
    - 缓解：旧 .php 页面保留 6 个月 + 顶部 banner 提示跳转新站。

---

## 九、估计总工时

- 阶段 0-2（基础）：3.5 小时
- 阶段 3-4（核心 + 排盘）：3.5 小时
- 阶段 5-6（详情 + 用户）：3.5 小时
- 阶段 7-8（SEO + 部署）：2.5 小时
- 测试 + bug 修复 buffer：2 小时

合计：约 15 小时（单 agent 工作量）。分 3 个工作日完成，每天 5 小时。

---

## 十、关键决策点（需要用户拍板）

### 决策 1：UI 组件库 — shadcn vs 自己写 vs daisyui

方案推荐 shadcn/ui（理由见第四章）。如果用户倾向：

- 自己写：工期 +3-5 小时，视觉完全可控。
- daisyui：工期 -1 小时，但视觉偏通用模板。

请拍板：**shadcn / 自己写 / daisyui**？

### 决策 2：鉴权方案 — Session vs JWT

方案推荐阶段一先用 Session（同源部署，改造最小），阶段二再迁 JWT。如果用户想：

- 直接 JWT：工期 +1 小时（PHP 装 firebase/php-jwt），但更标准。
- 纯 Session（同源）：工期最短，够用。

请拍板：**先 Session 再 JWT / 直接 JWT / 纯 Session 不迁**？

### 决策 3：SEO 策略 — 预渲染 vs SSR vs 不管

方案推荐 vite-plugin-prerender 预渲染关键页（Home / Articles / ArticleDetail）。如果用户想：

- 完整 SSR（Next.js）：工期翻倍（架构推倒重来），SEO 最好。
- 预渲染（推荐）：工期 +1.5 小时，覆盖 80% SEO 需求。
- 不管 SEO：工期 -1.5 小时，但百度流量会掉。

请拍板：**预渲染 / SSR / 不管**？

### 决策 4：支付接入 — mock vs 真接入

方案推荐阶段六先 mock（自动成功），后续再接微信 / 支付宝真支付。如果用户想：

- 直接真接入：工期 +2-4 小时（要商户号 + 回调地址 + SSL 校验）。
- mock 跑通：工期最短，跑通流程后切真接入。

请拍板：**mock 跑通 / 直接真接入**？

### 决策 5：灰度发布策略 — 直接切 / 蓝绿 / 子路径

方案推荐子路径灰度（新 SPA 跑在 /new，老 PHP 保留在 /）。如果用户想：

- 蓝绿部署：服务器开销 +1 份 dist，工期 +1 小时。
- 子路径灰度：推荐方案，零额外开销。
- 直接切：最快，但回滚要手动。

请拍板：**子路径 / 蓝绿 / 直接切**？

### 决策 6：旧 PHP 站点保留时长

方案推荐保留 6 个月 + 顶部 banner 提示。如果用户想：

- 立即下线：节省服务器，但老链接全 404。
- 保留 6 个月：推荐。
- 永久保留：服务器成本 +1。

请拍板：**立即下线 / 6 个月 / 永久**？

---

## 十一、附录：环境信息

- 工作目录：/root/bazi-namer/
- 前端已部署位置：/www/wwwroot/n.imoons.cn/dist/
- 后端位置：/www/wwwroot/n.imoons.cn/api/
- 老 PHP 站点：/www/wwwroot/name.imoons.cn/
- 老 PHP 页面：home.html / naming.html / result.html / name-detail.html / knowledge.html / article-detail.html / profile.html / redeem.html / about.html / history.html（10 个，跟任务描述一致）
- 老 PHP API：api/index.php / login.php / register.php / naming.php / article.php / strokes.php / wxlogin.php / redeem.php
- 当前跑动服务：pm2 bazi-namer (3001) / php-fpm / nginx
- 数据库：MySQL（users / orders / name_history / articles）
- PHP 依赖：6tail/lunar-php（农历）、MiniMax M3 AI
- 已有的 bazi-namer 进度：W1 + W2 完成（W3 待拍板）

---

文档结束。等用户拍板 6 个决策点后开工。
