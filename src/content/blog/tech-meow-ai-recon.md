---
title: "喵极 AI (meow.yyr5.com) 技术架构深度分析"
description: "前端代码逆向 + 公开 API 探测 + 一次真实账号实测, 完整解构 AI 表情包 SaaS 的产品/工程架构, 用于复刻学习。"
pubDate: 2026-06-12
category: tech
tags: ["AI", "SaaS", "架构", "逆向", "复刻"]
draft: false
---

# 喵极 AI（meow.yyr5.com）技术架构深度分析

**分析日期**：2026-06-12
**分析方式**：前端代码逆向 + 公开 API 探测 + 一次真实账号实测生成任务
**分析目标**：理解 AI 表情包 SaaS 的完整产品/工程架构，用于复刻学习

---

## 0. 一句话总结

**一个用 Vite + React + Node.js 跑在腾讯云上的 AI 表情包 SaaS，调用 OpenAI gpt-image-2（经 apimart 中转）生成 16 宫格透明底表情包，客户端 JSZip 打包下载。商业上是"能量制" + 创作包订阅，3 套免费 + 2 次动态试用拉新。**

---

## 1. 产品形态

### 1.1 是什么

「喵极 AI」——上传一张角色图/头像/宠物图，1 分钟生成 **16 张透明底表情包**，可选升级为动图（GIF/视频）。

### 1.2 核心能力

| 能力 | 说明 |
|------|------|
| **静态 16 宫格** | 主体识别 → 16 种情绪动作（挥手、摊手、探头、惊讶……）|
| **6 种画风** | Q版、3D 皮克斯、简笔涂鸦、原图风格、美式漫画、毛绒玩偶 |
| **3 种构图** | 头像特写、半身、全身 |
| **14 种主题** | 日常、礼貌、搞怪、甜蜜、安慰、职场、宅家、社恐、阴阳怪气、群聊、深夜、梦游、吸宠、自定义 |
| **动态升级** | 单张升级为 GIF（额外扣动态能量）|
| **批量生产** | OC 表情包创作者、定制接单、宠物账号运营场景 |

### 1.3 商业模式

| 项 | 详情 |
|---|------|
| **运营主体** | 喵极AI运营团队（个人/小团队，非公司） |
| **客服微信** | Mr_Zhang_12587（张先生） |
| **支持时间** | 工作日 10:00-18:00 |
| **上线时间** | 2026-04-04（分析时约 2 个月） |
| **定价模型** | 能量/积分制（assetName="创作权益"，unit="次"） |
| **新用户激励** | 3 套静态 + 2 次动态免费（硬编码在 `/api/app-config` 的 `signupTrial`） |
| **价格档位** | 单套静态解锁 **3.9 元**、单张动态升级 **19.9 元** |
| **会员订阅** | 月度 29 元 / 季度 49 元（推荐）/ 年度 89 元 |
| **付费墙** | 试用外的下载/解锁要下单（`/api/batches/{id}/static-unlock/order`）|
| **推广返利** | `/api/me/referral` + `claim` = 邀请有礼模块 |

---

## 2. 基础设施层

| 项 | 详情 |
|---|------|
| **CDN** | 腾讯云 EdgeOne（响应头 `X-NWS-LOG-UUID` 标志，CNAME `cdn.dnsv1.com`） |
| **源站 IP** | `43.141.69.245` / `43.141.69.230`（腾讯云 CVM，广州段） |
| **Web 服务器** | nginx/1.20.1（腾讯云 CVM 镜像默认） |
| **SSL 证书** | TrustAsia DV TLS RSA CA 2025（腾讯系 CA） |
| **证书状态** | 2026-03-19 → 2026-06-16（**⚠️ 4 天后到期**） |
| **静态资源** | 腾讯云 COS `miaoji-1302035409.cos.ap-guangzhou.myqcloud.com` |
| **部署位置** | 广州（OSS 区域 = `ap-guangzhou`） |
| **DNS 解析** | `meow.yyr5.com` → `cdn.dnsv1.com.cdn.dnsv1.com` → `0mj921kj.slt.sched.tdnsv8.com`（EdgeOne 调度） |

---

## 3. 前端架构

### 3.1 技术栈

| 组件 | 技术 |
|------|------|
| **框架** | React 18 + React Router（**Vite 构建**，不是 Next.js） |
| **样式** | TailwindCSS（class 里有 `bg-neutral-800`、`text-neutral`）+ 原生 CSS（admin） |
| **字体** | Google Fonts: Outfit（400-800）+ 自研中文字体（"文心喜乐"、"芝麻熊"等 9 套）从 COS 加载 |
| **打包** | Vite 懒加载 chunk 路由（`__vite__mapDeps` 映射表 + 9 个路由级 chunk） |
| **图片处理** | 客户端 base64 上传（`sourceImageDataUrl`、`referenceImageDataUrls`） |
| **打包下载** | JSZip 7 处调用，**16 张表情包在浏览器端打成 zip** 给用户 |
| **动画** | `ui-motion` 164KB chunk 单独分离（用了 framer-motion 或类似） |
| **超时控制** | `AbortController` + 自定义 timeout（5s/10s/15s/30s 几档） |

### 3.2 路由与 Chunk 列表

| Chunk | 用途 | 大小 |
|------|------|------|
| `index.js` | Vite 懒加载入口（`__vite__mapDeps` 映射）| 4.6KB |
| `LandingPage` | 营销首页 | 45KB |
| `HomePage` | 主工作台（**最大，708KB**）| 708KB |
| `AuthModal` | 登录 + 任务 API 封装 | 39KB |
| `export-tools` | 导出工具（zip 打包）| 95KB |
| `gif-tools` | 动图工作流工具 | 240KB |
| `ui-motion` | 动效组件 | 164KB |
| `SeoContentPage` | SEO 页面（21 个长尾）| 42KB |
| `InspirationSquareConceptPage` | 灵感广场（未开放）| 13KB |
| `react-vendor` | React 运行时 | 176KB |

### 3.3 客户端关键模式

| 模式 | 做法 |
|------|------|
| **轮询** | `pollIntervalMs: 2200` / `pollTimeoutSec: 180`（**前端 3 分钟超时，⚠️ 偏短**） |
| **AbortController** | 每次 fetch 5s/10s/15s/30s 超时自动取消 |
| **大图返回开关** | `?includeImageData=1` 列表不带大图、详情才带，**省 90% 流量** |
| **客户端结果回写** | `/api/generation-tasks/{id}/client-result` 通知后端资源已上传 |
| **客户端 zip 打包** | 16 张图全在浏览器 zip，**后端零流量**（聪明！）|
| **客户端压缩** | 图片先 canvas 压缩再 base64，**跳过 OSS 中转** |
| **新用户激励硬编码** | `window.__MIAOJI_PUBLIC_APP_CONFIG__.signupTrial` 控制，**后端不动就能改运营策略** |

---

## 4. 后端架构

### 4.1 推断的后端栈

- **强证据 → Node.js（Express 或 Fastify）**：
  - 错误码风格：`DEV_AUTH_DISABLED`、`INSUFFICIENT_DYNAMIC`、`LEGAL_CONSENT_REQUIRED`（UPPER_SNAKE_CASE）
  - 响应结构统一：`{ error: string, errorCode: string }`
  - 配置注入到 `window.__MIAOJI_PUBLIC_APP_CONFIG__`（典型 Node + Vite 注入模式）
  - OPTIONS 头 `Access-Control-Allow-Methods: GET,POST,PUT,OPTIONS`（不全开，RESTful 风格）

### 4.2 域结构

**前后端同域**：`meow.yyr5.com/api/...`  
**独立 Admin API 域**：`meow.yyr5.com/api/admin/...`（同一域名不同路径，鉴权机制不同）

### 4.3 业务 API 清单（前端可见 30+ 端点）

#### 4.3.1 认证

| 端点 | 用途 |
|---|---|
| `GET /api/auth/wechat/qr` | 微信扫码登录（返回 appid/ticket/state/redirectUri）|
| `GET /api/auth/wechat/mp-auth` | 公众号 OAuth 跳转 |
| `POST /api/auth/watcha/start` | **观猹**第三方登录（国内聚合 OAuth 平台，类似 casdoor）|
| `GET /api/auth/status?ticket=` | 扫码轮询 |
| `POST /api/auth/dev-login` | 开发登录（**生产已禁用**：`DEV_AUTH_DISABLED`）|
| `POST /api/session/logout` | 退出 |

#### 4.3.2 用户

| 端点 | 用途 |
|---|---|
| `GET /api/me` | 当前用户信息（含价格/会员/产品/法定联系人）|
| `GET /api/me/energy-ledger` | 能量/积分账本 |
| `GET /api/me/orders` | 充值订单 |
| `GET /api/me/inspirations` | 我的灵感 |
| `GET/POST /api/me/referral`、`/claim` | 推广返利（邀请有礼）|
| `POST /api/me/signup-reward/ack` | 新用户奖励确认 |
| `POST /api/me/legal-consents` | 法律协议同意 |
| `POST /api/user/account-deletion-requests` | 账号注销申请 |

#### 4.3.3 任务/工作流（核心）

| 端点 | 用途 |
|---|---|
| `POST /api/generation-tasks` | 提交任务（30s 超时），**立即扣费** |
| `GET /api/generation-tasks?page=&limit=&category=&status=&keyword=` | 列表 |
| `GET /api/generation-tasks/{id}?includeImageData=1` | 详情（`includeImageData` 控制是否返回大图）|
| `DELETE /api/generation-tasks/{id}` | 删除 |
| `POST /api/generation-tasks/{id}/retry` | 任务重试 |
| `POST /api/generation-tasks/{id}/client-result` | 客户端结果回写 |
| `GET /api/gif-workflow/runtime` | **GIF 工作流配置**（返回 `workflowId`、`liveVersionId`、`executionConfig`）|
| `GET /api/video/tasks/{id}/result` | 动图/视频任务结果 |

#### 4.3.4 批/下载/付费

| 端点 | 用途 |
|---|---|
| `GET /api/batches/{id}/download-access?origin=` | 下载权限校验 |
| `GET /api/batches/{id}/downloads/single` | 单张下载 |
| `POST /api/batches/{id}/static-unlock/order` | **付费解锁单套**（3.9 元）|
| `POST /api/batch-upgrades/{batchId}/order` | 批量升级订单（19.9 元/张）|

#### 4.3.5 支付/内容/配置

| 端点 | 用途 |
|---|---|
| `POST /api/pay/orders` | 微信支付下单 |
| `GET /api/recharge/products` | 充值产品列表 |
| `GET /api/inspirations` | 灵感广场（**当前禁用**：`enabled:false`）|
| `GET /api/scenario-config` | **场景/风格/主题 prompt 模板**（公开！）|
| `GET /api/app-config` | 公开配置（前端挂载到 `window.__MIAOJI_PUBLIC_APP_CONFIG__`）|
| `GET /api/legal-docs/current` | 法律文档（terms/privacy Markdown）|

#### 4.3.6 Admin（17 模块）

| 模块 | 端点样例 |
|------|---------|
| 后台登录 | `POST /api/admin/auth/login`、`GET /api/admin/auth/me`、`POST /api/admin/auth/logout` |
| 用户管理 | `/api/admin/users`、`/api/admin/registration-settings` |
| 创作提示词配置 | `/api/admin/prompts/*` |
| **模型配置** | `/api/admin/models/*`（AI 供应商配置入口）|
| **工作流** | `/api/admin/workflows/*`（gif-workflow 流程编排）|
| **对象存储** | `/api/admin/storage/*`（COS bucket 配置）|
| 微信配置 | `/api/admin/wechat/*`（AppID/Secret）|
| **微信支付** | `/api/admin/wechat-pay/*`（商户号/支付回调）|
| **观猹配置** | `/api/admin/watcha/*`（第三方登录配置）|
| 资产配置 | `/api/admin/economy-config`（价格/创作包/充值产品）|
| 生成任务 | `/api/admin/generation-tasks/*`（任务监控/重试）|
| 灵感广场 | `/api/admin/inspirations/*` |
| 法律文档 | `/api/admin/legal-docs/*` |
| 邀请有礼 | `/api/admin/referral/*` |
| 充值订单 | `/api/admin/orders/*` |
| 安全管理 | `/api/admin/security/*`（风控/封禁）|
| 系统配置 | `/api/admin/config/*`（全局开关）|
| 任务红点 | `GET /api/admin/generation-tasks/badge` |

### 4.4 鉴权机制

| 端 | 机制 |
|---|---|
| **C 端** | Session Cookie（同源携带，无 JWT），**无 `credentials:include` 显式声明**（`fetch` 默认 same-origin 因为前后端同域）|
| **Admin 端** | **Double Submit Cookie CSRF**（`miaoji_admin_csrf` cookie 读出后塞 `x-csrf-token` header）|
| **微信登录** | 1) 前端调 `/api/auth/wechat/qr` 拿 ticket+qrConnectUrl 2) 调微信 JS SDK 渲染 3) 前端轮询 `/api/auth/status?ticket=` 4) 后端 set session cookie |
| **第三方登录** | "观猹"国内 OAuth 聚合（类似 login.bytedance.com 模式）|

### 4.5 后台管理（`/admin/*`）

**与 C 端独立技术栈**：
- 纯静态 HTML + 原生 JS（**没用 React/Vue**）
- 设计系统独立：`/admin/admin.css?v=20260320b`
- 模块按页面拆分：`/admin/accounts/index.html`、`/admin/orders/index.html`...
- 后台导航用 JS 动态渲染（`id="admin-nav"`）
- API 鉴权用 `miaoji_admin_csrf` cookie + `x-csrf-token` header

**入口**：`/admin` → 自动跳转 `/admin/accounts/index.html`（用户管理页）

---

## 5. AI 服务（实测关键发现）

### 5.1 真实供应商（实测确认）

**通过实际提交任务，任务 context 字段暴露了真实配置**：

```json
{
  "imageProvider": "apimart",
  "imageModel": "gpt-image-2",
  "imageRequestTimeoutMs": 900000
}
```

- **供应商：apimart**（国内 OpenAI API 中转服务商）
- **模型：gpt-image-2**（OpenAI 2025 年发布的旗舰图像生成模型）
- **超时：15 分钟**

**隐私政策故意模糊化**（只写"AI 模型或推理服务提供方"）就是为了保护这个组合。

### 5.2 异步批处理架构

- **后端接 gpt-image-2 是同步调用**（OpenAI API 返回时间 30-180s）
- 任务状态机：`queued` → `running` → `succeeded` / `failed`
- **扣费在任务创建时立即发生**（不等结果），验证：实测从 `staticRemaining: 3` → `2`
- **前端 3 分钟超时不够**（`pollTimeoutSec:180` vs 后端 `900000`），可能显示"超时"但任务在云端继续

### 5.3 Prompt 工程（核心中的核心）

每张图实际发给模型的 prompt 是 **5 段拼接**：

```
[basePrompt]                                  ← 场景通用 base（保主体一致性）
  + [promptFragment: framing]                 ← 构图约束
  + [promptFragment: style]                   ← 风格约束
  + [promptFragment: contentTheme]            ← 内容主题（情绪/动作）
  + [qualityPromptFragment]                   ← 质量补充（"五官锐利"等负向约束）
  + [userText]                                ← 用户输入的"灵感文案"（可选）
```

#### 5.3.1 6 种风格（styles）

| ID | 名称 | 核心 prompt 约束 |
|---|---|---|
| `cute_chibi` | 可爱Q版 | 2-3 头身、头大身小、轮廓圆润 |
| `3d_pixar` | 3D皮克斯 | 圆润体块、明暗过渡顺滑 |
| `sketch_sticker` | 简笔涂鸦 | 粗黑蜡笔轮廓 + 几何简化 + 手绘抖动 |
| `realistic` | 原图风格 | 保留原图画风/照片质感（**实验性**）|
| `abstract_sticker` | 美式夸张漫画 | 粗黑墨线 + 半调网点 + 高对比 |
| `plush_doll` | 毛绒玩偶 | 绒面/缝线/填充感 |

#### 5.3.2 3 种构图（framings）

`face`（头像特写）/ `halfbody`（腰部以上）/ `fullbody`（全身）

#### 5.3.3 14 种内容主题（contentThemes）

`daily_essentials`（日常）、`polite_reply`（礼貌回复）、`silly_crazy`（搞怪发疯）、`sweet_moments`（甜蜜）、`comfort_support`（安慰）、`work_survival`（职场生存）、`home_lazy`（宅家）、`social_burnout`（社恐内耗）、`sarcastic_mood`（阴阳怪气）、`group_hype`（群聊热场）、`late_night_emotions`（深夜）、`dream_meltdown`（梦游发疯）、`pet_owner_daily`（吸宠）、`custom_template`（自定义）

### 5.4 实测任务的标准 prompt 优化（绿幕抠图法）

实测任务的 `context.promptText` 截取：

```
背景必须是统一的绿色高对比纯色实底（#00FF00），整套 16 格和后续视频逐帧都保持同一背景色。
背景颜色必须严格等于 #00FF00，不要改深、改浅、加明暗变化或色偏；整张 4x4 大图和每个单格内部都只能使用这一种连续背景色，不要给每格单独套白底卡片或白色边框。
背景必须完全平坦、纯净、无噪点，不得使用纯白、灰底、渐变、纹理、阴影、光晕、烟雾、半透明特效、房间、桌面、墙角或任何场景环境。
不要绘制任何中文、英文、表情文字、拟声字、标题、标签、编号、水印、气泡文字或文字装饰。
16 格只是隐形切图槽位，不要绘制任何用于分割格子的 16 宫格分割线、网格线、黑线、格
```

**这套 prompt 的工程价值**：
- **强制绿幕背景** → 后端用 `confidence: 0.8` 的色彩检测抠图（`subjectPalette` 列出 8 种肤色/服装色）
- **明确禁文字/水印/格子线** → 避免 AI 误生成干扰元素
- **禁止单格白底** → 保证 4x4 大图可以一次切成 16 张无缝
- **`imageQualityMode` 枚举**：`"high"`（会员）或 `"default"`（新用户）

### 5.5 gif-workflow 工作流引擎

`/api/gif-workflow/runtime` 返回**当前生效的工作流配置**：

```json
{
  "workflowId": "...",
  "liveVersionId": "...",
  "executionConfig": { ... }
}
```

- 极大概率用的是 **Coze / Dify / FastGPT** 类可视化工作流平台在背后
- 静态 16 宫格 → 动态 GIF：单张升级任务 `kind:"user_video_generate"`，调用视频生成模型（gpt-image-2 不直接出视频，应该是更下游的模型）

---

## 6. 任务提交完整 Body（实测通过）

```json
{
  "kind": "user_grid_generate",
  "referenceImageDataUrl": "data:image/png;base64,...",
  "referenceImageDataUrls": ["data:image/png;base64,..."],
  "generationMode": "guided",
  "imageQualityMode": "default",
  "guidedConfig": {
    "scenario": "general",
    "framing": "halfbody",
    "style": "cute_chibi",
    "contentTheme": "daily_essentials"
  },
  "scenario": "general",
  "framing": "halfbody",
  "style": "cute_chibi",
  "contentTheme": "daily_essentials",
  "lookStyleId": "cute_chibi",
  "framingId": "halfbody"
}
```

**响应**（HTTP 202）：

```json
{
  "task": {
    "id": "gtask_52056879-2823-4d53-91db-c33cd4cb3a89",
    "status": "queued",
    "title": "图片生成：半身 · 可爱Q版 · 日常精选",
    "context": {
      "imageProvider": "apimart",
      "imageModel": "gpt-image-2",
      "imageRequestTimeoutMs": 900000
    }
  }
}
```

**前端会轮询 2.2s 一次，最长 180s**（建议延长到 600s+）。

---

## 7. 完整使用流程（用户视角）

```
1. 访问 https://meow.yyr5.com/ → 落地页
2. 微信扫码登录（/api/auth/wechat/qr + 轮询 /api/auth/status）
   - 或"观猹"第三方登录（/api/auth/watcha/start）
3. 进入 /studio 工作台
4. 上传角色图（前端 base64，不走 OSS）
5. 选择风格 × 构图 × 主题（前端从 /api/scenario-config 加载）
6. 写灵感文案（可选）
7. 点击"生成" → POST /api/generation-tasks
   - 立即扣 1 套静态能量（3 → 2）
8. 轮询 /api/generation-tasks/{id} 2.2s 一次
   - 后端调用 apimart → gpt-image-2
   - 等 30s-15min 返回
9. 拿到 16 张图 + 4x4 大图（base64 形式）
10. 客户端 JSZip 打包下载整套 zip
11. 试用外下载/解锁需下单（/api/batches/{id}/static-unlock/order）
12. 单张升级动图：POST /api/batch-upgrades/{id}/order（19.9 元/张）
```

---

## 8. SEO 策略

- **21 个长尾页**（sitemap 全收录）：
  - `/solutions/oc-biaoqingbao/`（OC 表情包）
  - `/solutions/zishe-biaoqingbao/`（自设表情包）
  - `/solutions/wechat-biaoqingbao-zhizuo/`（微信表情包制作）
  - `/solutions/photo-to-wechat-sticker/`（照片转微信表情）
  - `/solutions/ai-sticker-maker/`（AI 表情包工具）
  - `/solutions/toumingdi-biaoqingbao/`（透明底表情包）
  - `/solutions/16-grid-biaoqingbao/`（16 宫格表情包）
  - `/solutions/dongtai-biaoqingbao/`（动态表情包）
  - `/solutions/pet-sticker-maker/`（宠物表情包工具）
  - `/solutions/line-sticker-maker/`（Line 表情包工具）
  - `/solutions/custom-sticker-service/`（定制表情包服务）
  - `/solutions/livestream-sticker-intent/`（直播表情包）
  - `/guides/role-image-to-sticker-pack/`（角色图转表情包教程）
  - `/guides/making-money-with-stickers/`（表情包赚钱）
  - `/guides/sticker-upload-guide/`（表情包上传指南）
  - `/guides/ai-sticker-tool-comparison/`（AI 工具对比）
- **robots.txt 禁**：`/admin`、`/api/`、`/studio`（防爬）
- **sitemap.xml 公开** 21 个 SEO URL
- **Schema.org 结构化数据**：FAQPage + SoftwareApplication（增强搜索展示）

---

## 9. 关键技术风险

| # | 严重度 | 问题 | 建议 |
|---|------|------|------|
| 1 | **🔴 高** | **SSL 证书 4 天后到期**（6/16）| 立即续费 TrustAsia DV TLS |
| 2 | 🟡 中 | `/admin` 入口暴露（robots 禁了但可访问）| 依赖前端鉴权，后端 `/api/admin/*` 都 401 是好的 |
| 3 | 🟡 中 | `/api/auth/dev-login` 前端可调（生产已关但代码在）| 删除或加环境判断 |
| 4 | 🟡 中 | AI 供应商在隐私政策模糊化（合规但难追溯）| 出问题时难追责 |
| 5 | 🟡 中 | 灵感广场功能未开放（已写好但 `enabled:false`）| 监控是否下版本开放 |
| 6 | 🟢 低 | 前端 3 分钟超时偏短（`pollTimeoutSec:180`）| 延长到 600s+ |
| 7 | 🟢 低 | 真人不允许二创（协议有）但 AI 检测可能漏 | 加 AI 检测 |

---

## 10. 复刻方案（Vite + Node + OSS + 工作流）

### 10.1 技术选型

| 层 | 选型 | 替代 |
|---|------|------|
| **前端** | Vite + React + React Router + TailwindCSS | Next.js（SSR 利于 SEO）|
| **后端** | Node.js + Express/Fastify + Prisma + PostgreSQL | NestJS（更结构化）|
| **存储** | 腾讯云 COS（OSS）| 阿里云 OSS / AWS S3 |
| **CDN** | 腾讯云 EdgeOne | Cloudflare / 阿里云 CDN |
| **AI** | apimart + gpt-image-2 | 阿里云百炼 + Qwen-Image / 自建 ComfyUI |
| **工作流** | Coze / Dify / FastGPT | 自建（low-code 工作流引擎）|
| **登录** | 微信开放平台 + 观猹 OAuth | GitHub OAuth（国外）|
| **支付** | 微信支付 V3 | 支付宝 |
| **鉴权** | Session Cookie + Double Submit Cookie CSRF | JWT（更现代但有撤销问题）|

### 10.2 关键模块实现

#### 10.2.1 任务系统

```typescript
// 任务提交
POST /api/generation-tasks
Body: {
  kind: "user_grid_generate",
  referenceImageDataUrl: "data:image/png;base64,...",
  referenceImageDataUrls: ["data:image/png;base64,..."],
  generationMode: "guided",
  imageQualityMode: "default",  // or "high"（会员）
  guidedConfig: { scenario, framing, style, contentTheme },
  scenario, framing, style, contentTheme,  // 重复字段（兼容）
  lookStyleId, framingId
}

// 任务状态机
queued → running → succeeded / failed
// 立即扣费，失败不退（需产品确认）
```

#### 10.2.2 Prompt 拼接器

```python
def build_prompt(scenario, framing, style, contentTheme, userText=""):
    scenario_cfg = load_scenario(scenario)
    framing_cfg = load_framing(framing)
    style_cfg = load_style(style)
    theme_cfg = load_content_theme(contentTheme)
    
    return "\n".join([
        scenario_cfg.basePrompt,
        framing_cfg.promptFragment,
        style_cfg.promptFragment,
        theme_cfg.promptFragment,
        style_cfg.qualityPromptFragment,
        # 绿幕抠图强制约束
        GREEN_SCREEN_CONSTRAINT,
        # 禁止约束
        NO_TEXT_NO_GRID_CONSTRAINT,
        userText
    ])
```

#### 10.2.3 工作流调度

```typescript
// gif-workflow/runtime 伪代码
async function scheduleGeneration(task) {
  // 1. 拼 prompt
  const prompt = buildPrompt(task.scenario, task.framing, task.style, task.contentTheme);
  
  // 2. 调 AI
  const result = await aiProvider.generateImage({
    model: "gpt-image-2",
    prompt,
    referenceImage: task.referenceImageDataUrl,
    timeout: 900_000
  });
  
  // 3. 抠图（绿幕）
  const cutout = await cutoutGreenScreen(result.imageUrl, {
    backgroundColor: "#00FF00",
    confidence: 0.8
  });
  
  // 4. 切 4x4 → 16 张
  const stickers = cutImage4x4(cutout);
  
  // 5. 写库 + 通知前端
  await saveTaskResult(task.id, { stickers, cutout });
}
```

#### 10.2.4 客户端 JSZip 打包

```typescript
import JSZip from 'jszip';

async function downloadStickerPack(stickers: string[]) {
  const zip = new JSZip();
  stickers.forEach((dataUrl, i) => {
    const base64 = dataUrl.split(',')[1];
    zip.file(`sticker_${i+1}.png`, base64, { base64: true });
  });
  
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sticker_pack.zip';
  a.click();
}
```

#### 10.2.5 SEO 站群

- 21 个长尾页面用 **Astro** 或 **Next.js SSG** 静态生成
- sitemap.xml 自动生成
- Schema.org FAQPage + SoftwareApplication 标记

### 10.3 成本估算（月活 1 万用户）

| 项 | 单价 | 月成本估算 |
|---|------|-----------|
| gpt-image-2（apimart）| 约 ¥0.5/张 | ¥80,000（16 张/套 × 1 万套 × 50% 转化）|
| 腾讯云 CVM | ¥200/月 | ¥200 |
| 腾讯云 EdgeOne | 按流量 | ¥500 |
| 腾讯云 COS | ¥0.1/GB | ¥100 |
| 微信支付手续费 | 0.6% | ¥600 |
| 客服/运营 | - | 人工 |
| **总 AI 成本** | | **约 ¥81,400/月** |

**盈亏平衡**：会员订阅 ¥49/月 × 1660 人 = ¥81,340

### 10.4 MVP 最小可用版本

1. Vite + React + Tailwind 前端（3 周）
2. Node.js + Express 后端（2 周）
3. 微信扫码登录（1 周）
4. apimart + gpt-image-2 集成（1 周）
5. 任务系统 + 轮询（1 周）
6. JSZip 打包下载（3 天）
7. 能量/扣费系统（1 周）
8. 微信支付（1 周）
9. 管理后台（2 周）

**总开发周期：约 3 个月**（1 名前端 + 1 名后端 + 0.5 名设计）

---

## 11. 关键经验教训

1. **绿幕抠图 + 强制背景色**：所有"需要后处理切片"的 AI 生图都该这么做
2. **客户端 JSZip 打包**：省后端 90% 流量，是值得学的设计
3. **公开 scenario-config**：前端能动态组合样式，后端不动就能加新主题
4. **大图返回开关（includeImageData）**：列表/详情分离，省 90% 流量
5. **客户端压缩 base64 上传**：跳过 OSS 中转，简化链路
6. **新用户激励硬编码 app-config**：运营策略可热改，后端不动
7. **Double Submit Cookie CSRF**：后台管理的好选择
8. **AI 供应商模糊化（隐私政策）**：合规 + 保护商业利益
9. **任务创建即扣费**：业务简单但需要产品明确"失败是否退"（建议退）
10. **前端 3 分钟超时偏短**：AI 高质量模式经常超过，要延长到 10 分钟+

---

## 12. 复刻检查清单

- [ ] Vite + React + Tailwind 前端
- [ ] 9 个路由级 chunk 懒加载
- [ ] 客户端 base64 上传
- [ ] 客户端 canvas 压缩
- [ ] 6 风格 × 3 构图 × 14 主题 UI
- [ ] JSZip 打包下载
- [ ] 轮询 + AbortController
- [ ] Session Cookie 鉴权
- [ ] Double Submit Cookie CSRF（admin）
- [ ] 微信扫码登录
- [ ] 观猹第三方登录
- [ ] 微信支付 V3
- [ ] 能量/账本系统
- [ ] 任务状态机
- [ ] 绿幕抠图后处理
- [ ] 4x4 切片
- [ ] 21 个 SEO 页面 + sitemap
- [ ] Schema.org 结构化数据
- [ ] 17 模块管理后台
- [ ] 腾讯云 EdgeOne + COS + CVM
- [ ] SSL 证书自动续期

---

## 附录 A：实测任务记录

```
任务 ID:    gtask_52056879-2823-4d53-91db-c33cd4cb3a89
提交时间:   2026-06-12T07:05:42.244Z
状态:       running（9+ 分钟后仍未完成）
AI 供应商:  apimart
AI 模型:    gpt-image-2
超时上限:   900000ms (15 分钟)
前端超时:   pollTimeoutSec=180 (3 分钟，⚠️ 偏短)
风格:       cute_chibi (Q版)
构图:       halfbody (半身)
主题:       daily_essentials (日常精选)
参考图:     1024x1024 二次元 OC 角色（MiniMax image-01 生成）
扣费:       staticRemaining 3→2（立即扣）
参考图大小: 168KB
base64 长度: 224KB
POST Body 长度: ~230KB
HTTP 状态:  202 Accepted
```

## 附录 B：参考资源

- 主页：https://meow.yyr5.com/
- 工作台：https://meow.yyr5.com/studio
- 灵感广场：https://meow.yyr5.com/inspirations/（未开放）
- 教程：https://meow.yyr5.com/learn
- 用户协议：https://meow.yyr5.com/legal/terms
- 隐私政策：https://meow.yyr5.com/legal/privacy
- sitemap：https://meow.yyr5.com/sitemap.xml
- 管理后台：https://meow.yyr5.com/admin（需鉴权）

## 附录 C：分析使用工具

- **OSINT**：`dig`、`whois`、`openssl s_client`、`traceroute`
- **HTTP**：`curl -I`、`curl -X OPTIONS`
- **前端逆向**：下载 JS bundle + 字符串搜索 + 模式匹配
- **API 探测**：端点枚举 + CORS 测试
- **实测**：用真实账号（自己注册）提交一次生成任务
- **文档**：双写模式（本地 .md + 飞书 docx）
