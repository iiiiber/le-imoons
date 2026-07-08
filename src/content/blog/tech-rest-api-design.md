---
title: "RESTful API 设计实战: 从入门到精通"
description: "做后端开发这么多年, 见过太多乱七八糟的 API 设计: 把 API 当 RPC 写, URL 塞动词, 状态码抛脑后。讲讲怎么设计一个合格的 RESTful API。"
pubDate: 2026-06-25
category: tech
tags: ["RESTful", "API", "后端", "设计"]
draft: false
---

# RESTful API 设计实战：从入门到精通

做后端开发这么多年，我见过太多乱七八糟的 API 设计。有人把 API 当作 RPC 来写，一个接口既查又改；有人 URL 里塞满了动词，`/getUserInfo`、`/deleteUserById`；还有人把 HTTP 状态码抛在脑后，返回 200 实际是错误。

今天聊聊怎么设计一个合格的 RESTful API。

## 什么是 REST

REST（Representational State Transfer）本质上是一套设计 Web API 的**指导思想**。核心就三点：

1. **资源优先**：URL 描述的是"什么东西"，而不是"做什么操作"
2. **统一接口**：所有操作都通过 HTTP 方法完成
3. **无状态**：每次请求都包含所有必要信息

好的 REST API 用名词来描述资源，用 HTTP 动词来描述操作。

## URL 应该怎么写

先看几个反例：

```
❌ /getUserInfo?id=123
❌ /deleteUserById?id=123
❌ /user/update?id=123
❌ /user/delete?id=123
```

这些问题的本质是把动作塞进了 URL。RESTful 的写法：

```
✅ GET    /users/123        # 获取用户
✅ POST   /users             # 创建用户
✅ PUT    /users/123         # 完整更新
✅ PATCH  /users/123         # 部分更新
✅ DELETE /users/123         # 删除用户
```

### 几个硬规则

**名词用复数**：Collections 用复数形式，一目了然。

```
GET /users        # 获取用户列表
GET /users/123    # 获取指定用户
```

**层级关系用路径表达**：

```
GET /users/123/orders          # 获取用户123的所有订单
GET /users/123/orders/456      # 获取用户123的456号订单
```

**查询参数留给筛选和分页**：

```
GET /users?status=active&page=2&per_page=20
```

## HTTP 状态码：别只会返回 200

这是最容易踩坑的地方。太多项目所有接口都返回 200，然后在 body 里塞个 `code: 500` 来表示错误。这是把 HTTP 当作传输协议用，完全浪费了状态码的能力。

**必须掌握的 5 类状态码**：

| 状态码 | 含义 | 适用场景 |
|--------|------|----------|
| 200 | OK | 成功返回数据 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数有误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 错误响应格式

统一错误格式非常重要，推荐这样：

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "用户不存在",
    "detail": "用户ID 123 在系统中未找到"
  }
}
```

> [!warning] 注意
> 不要在错误信息里暴露敏感的系统路径、SQL 语句、堆栈等。这些只能记录日志，不能返回给客户端。

## 版本管理：API 升级的生存指南

API 不可避免要升级，但已有客户端不能突然断掉。主流方案：

```
✅ /v1/users      # URL 路径
✅ /users?version=1  # 查询参数（不推荐）
Header: Accept: application/vnd.myapi.v1+json  # HTTP 头（最规范）
```

个人建议用 URL 路径，简洁直观，Nginx 配个重定向规则就能做灰度。

## 分页：列表接口的灵魂

没有分页的列表接口迟早出事。推荐 Cursor-based 分页，性能最好：

```
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20
```

返回：

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  }
}
```

> [!tip] 小技巧
> 默认 limit 不要太大，20-50 比较合适。最大也设个上限，比如 100，防止有人传个 999999 把你数据库拖垮。

## 总结

好的 API 设计就两个标准：

1. **让人看得懂**：URL 一眼知道查什么资源
2. **让人用得稳**：错误情况有明确的状态码和提示

剩下的就是经验积累，多看多想，慢慢就有感觉了。
