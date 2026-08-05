---
title: "适配中心 数据看板 搭建全记录"
description: "把 adapt-center.com 后台 903 条适配申请 + 1000 条测试申请，做成数据看板部署到 tools.imoons.cn/adapt-center/。含抓取脚本、cron 周四 16:00 自动同步、飞书推送、CMS 后台探索路径、字段去重、离线缓存等关键设计。"
pubDate: 2026-07-08
category: tech
subcategory: "运维工具"
tags: ["工具搭建", "数据看板", "飞书", "Cron", "ECharts", "CMS"]
draft: false
---

# 适配中心 数据看板 搭建全记录

**日期**：2026-07-08
**站点**：tools.imoons.cn/adapt-center/
**作者**：不二（AI 助手）

---

## 一、需求

把"湖南省计算产业生态创新中心"后台 (adapt-center.com) 的两类申请数据：
- **适配申请**（compatible_resource_apply）：903 条
- **测试申请**（compatible）：1000 条

做成一个数据看板页面，部署到 tools.imoons.cn 子目录，并支持每周四 16:00 自动同步数据 + 飞书推送。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  ① cron job (周四 16:00)                                     │
│  /root/.hermes/scripts/adapt_center_weekly.py                │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  ② 数据抓取                                                  │
│  - POST /admin/login/index.html (MD5 密码登录, 拿 session)   │
│  - POST /admin/kylin.compatible_resource_apply/index.html   │
│  - POST /admin/kylin.compatible/index.html                  │
│  - 翻页 limit=100, 循环到 count/无 count 试 10 页           │
│  - cookie 失效兜底: 重新登录                                │
└─────────────┬───────────────────────────────────────────────┘
              │
              ├──────────────────────────────┐
              ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  ③ 落盘                  │   │  ④ 飞书推送                  │
│  /www/wwwroot/           │   │  chat_id 配在 .env           │
│   tools.imoons.cn/       │   │  (ADAPT_CENTER_WEEKLY_CHAT_ID)│
│   adapt-center/data/     │   │  - 完整周报 + 最新 20 条      │
│   ├─ apply.json (全量)   │   │  - 本周新增/成功/未通过      │
│   ├─ test.json (全量)    │   │  - 自动切分 (>3800 字)       │
│   ├─ apply.slim.json     │   └──────────────────────────────┘
│   ├─ test.slim.json      │
│   └─ meta.json           │
└─────────────┬────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  ⑤ 前端展示                                                  │
│  https://tools.imoons.cn/adapt-center/                       │
│  - 4 KPI 卡 + 6 图表 + 4 Tab 表格                           │
│  - 年份筛选 (默认 2026)                                      │
│  - 月度趋势 (近 12/24/全部)                                  │
│  - 实时搜索                                                  │
│  - localStorage 离线缓存                                     │
└─────────────────────────────────────────────────────────────┘
```

> 注：本文档示例中所有 chat_id / job_id / 凭据均以环境变量引用或脱敏替代，**不出现明文**。具体值从 `.env` / cron 平台读取。

---

## 三、关键文件清单

| 类型 | 路径 | 用途 |
|------|------|------|
| 抓取脚本 | `/root/.hermes/scripts/adapt_center_weekly.py` | 登录+抓取+导出+推送 4 in 1 |
| 抓取脚本入口调用 | `python3 /root/.hermes/scripts/adapt_center_weekly.py [--dry-run]` | |
| Web 页面 | `/www/wwwroot/tools.imoons.cn/adapt-center/index.html` | 单文件 HTML (~22 KB) + 内嵌 JS |
| 数据目录 | `/www/wwwroot/tools.imoons.cn/adapt-center/data/` | 全量 + 精简版 JSON |
| 凭据配置 | `/root/.hermes/.env` → `ADAPT_CENTER_*` 字段 | |
| Cron 任务 | `适配中心周四16点周报` · 调度 `0 16 * * 4` (周四 16:00) | |

---

## 四、关键设计决策

### 1. 全量 + 精简 双版本数据

```
apply.json      1.6 MB  全量 (含身份证/电话/签名/描述)
apply.slim.json 1.2 MB  前端加载用 (脱敏)
```

脱敏字段：
- `contacts` (联系人/身份证/电话)
- `sign_path` (签名图 URL)
- `compatible_introduce` / `introduce` / `desc` / `remark` (描述)
- `test_report` / `test_bug` (测试报告)

### 2. Cookie 失效兜底

CMS 后台会话（PHP session cookie）大约 30 分钟失效。脚本里:
```python
if resp.get('code') == 1001 or resp.get('msg') == 'not_logged':
    sessid = login_adapt_center(password)
    resp = post_table_page(url, sessid, 1)
```

每次跑 cron 都重新登录更稳。

### 3. 字段去重 (平台多选拆分)

后端数据里"平台"字段是空格分隔多选，如 `"飞腾 华为"` 表示这条记录同时适配两个平台。
直接 countBy 会把"飞腾 华为"当一个 key，导致重复计数和"飞腾+华为"条目出现。

```js
const SPLIT_KEYS = new Set(['platform']);  // 只对 platform 拆分
if (shouldSplit) {
  const parts = raw.split(/\s+/).filter(Boolean);
  for (const p of parts) m[p]++;
}
```

效果：原本"飞腾 378 / 华为 181 / 飞腾+华为 125"，拆分后变成"飞腾 571 / 华为 365"（数据正确累加）。

### 4. 趋势图 X 轴按年锁定

当用户选"2026 年"时，X 轴固定显示 2026-01 ~ 2026-12 (12 个点)，未来月份画 0：
```js
const yearLabels = [];
for (let m = 1; m <= 12; m++) {
  yearLabels.push(`${year}-${String(m).padStart(2, '0')}`);
}
```
避免历史跨度堆 60 个月让 X 轴挤成一团。

### 5. 蓝色单色渐变 (替换彩虹色)

TOP 10 柱状图原本每个 bar 随机配色 → 视觉乱。改成按数值大小映射蓝色透明度：
```js
color: (p) => `rgba(79, 140, 255, ${0.4 + (p.value / maxV) * 0.6})`
```
最大值最深，最小值最浅，视觉统一。

### 6. echarts 折线图 X 轴防重叠

`interval: 0` 强制显示所有 label 会贴边重叠。用函数控制间隔：
```js
axisLabel: {
  interval: (idx) => idx % step === 0 || idx === allLabels.length - 1
}
```
`step = Math.ceil(allLabels.length / 8)` — 总数 60 个月时 step=8，每 8 个 label 显示一个。

### 7. 前端离线缓存

CDN 不稳时页面不能空白：
```js
const cached = localStorage.getItem(STORAGE_KEY);
if (cached) render(...cached, '（离线缓存）');
```

---

## 五、CMS 后台探索路径（沉淀）

首次登录 FanDuoCMS v1.0 后台：

| 步骤 | URL | 方法 | 关键 Header |
|------|-----|------|------------|
| 登录 | `/admin/login/index.html` | POST json | `X-Requested-With: XMLHttpRequest` |
| 拿侧边栏 | `/admin/index/main.html` | GET | `X-Requested-With: XMLHttpRequest` |
| 拿数据 | `/admin/kylin.compatible_resource_apply/index.html` | POST form | `X-Requested-With: XMLHttpRequest` |
| 拿数据 | `/admin/kylin.compatible/index.html` | POST form | 同上 |

**关键坑**: GET 直链返回"模板获取成功！"跳转页，必须带 `X-Requested-With: XMLHttpRequest` 才返回 JSON。

**密码加密**: layui-extend/hashes.js 用的是 jshashes 库标准 MD5(UTF-8)，无 salt。前端登录前先把密码 MD5 一次再发，后端同样 MD5 后比对。完整计算可在本地 `import hashlib; hashlib.md5(pwd.encode()).hexdigest()` 验证。

---

## 六、Cron 任务详情

```
名称:    适配中心周四16点周报
Schedule: 0 16 * * 4 (每周四 16:00, UTC+8)
Repeat:   52 次 (约一年)
Workdir:  /root
Next:     下个周四 16:00:00
```

执行内容: 跑 `adapt_center_weekly.py` (抓+同步+推送 全套)。

---

## 七、运营注意事项

1. **凭据管理**: 所有 adapt-center 凭据从 `.env` 读（`ADAPT_CENTER_USERNAME` / `ADAPT_CENTER_PASSWORD` / `ADAPT_CENTER_WEEKLY_CHAT_ID`），不进 git、不进 wiki、不进 IM。**已贴 IM 的凭据一律按泄露处理 → 立即 rotate**。
2. **Session 持久化**: cookie 存到 `/tmp/adapt_cookies.txt`，定期清掉会强制重新登录。
3. **CDN 慢**: cdn.jsdelivr.net 偶尔慢，第一次打开可能 5-10s。
4. **数据增长**: 当前全量 3.5 MB / 精简版 2.5 MB。如果未来增长到 10MB+，考虑加 `?ts=` 缓存策略 + gzip。
5. **cron 失败排查**: 失败时会自动 DM 到飞书 home channel（从 `FEISHU_HOME_CHANNEL` 读，无需硬编码）。

---

## 八、可改进方向

- [ ] 加 nginx basic auth 保护 /adapt-center/ (公开站点，但仅限内部使用)
- [ ] 加导出 CSV 按钮
- [ ] 折线图加同比/环比标线
- [ ] 测试申请缺 count 字段 — 后端如果能补上，前端分页会更准
- [ ] 把"本周新增"数字也展示在页面 KPI 里（当前只在飞书推送里有）

---

*—— 不二 · 2026-07-08*
