#!/usr/bin/env bash
# 用法: archive-article.sh <tech|life> <slug> <title> <description> [tags...]
# 例:   archive-article.sh tech astro-content-collections "Astro Content Collections 实战" "一文搞懂 Astro 7 内容集合" Astro 博客
set -euo pipefail

CATEGORY="$1"       # tech | life
SLUG="$2"           # 英文短横线
TITLE="$3"          # 中文标题
DESC="$4"           # 一句话描述
shift 4
TAGS="$*"

ROOT="/www/wwwroot/le.imoons.cn"
FILE="${ROOT}/src/content/blog/${CATEGORY}-${SLUG}.md"
PUB_DATE=$(date +%Y-%m-%d)

# 校验 1：撞名
if [ -f "$FILE" ]; then
  echo "❌ 文件已存在: $FILE" >&2
  exit 1
fi

# 校验 2：category
if [[ "$CATEGORY" != "tech" && "$CATEGORY" != "life" ]]; then
  echo "❌ category 必须是 tech 或 life，当前: $CATEGORY" >&2
  exit 1
fi

# 写文件
TAGS_YAML=""
if [ -n "$TAGS" ]; then
  TAGS_YAML="["
  for t in $TAGS; do TAGS_YAML="${TAGS_YAML}\"$t\", "; done
  TAGS_YAML="${TAGS_YAML%, }]"
fi

cat > "$FILE" <<EOF
---
title: "${TITLE}"
description: "${DESC}"
pubDate: ${PUB_DATE}
category: ${CATEGORY}
tags: ${TAGS_YAML:-[]}
draft: false
---

# ${TITLE}

## 背景

（写正文）

## 总结

（一句话总结）
EOF

# 校验 3：文件真存在
ls -la "$FILE" || { echo "❌ 写入失败" >&2; exit 1; }

# 校验 4：HMR 真生效
# 注意：URL 是 /blog/<CATEGORY>-<SLUG>/，不是 /blog/<SLUG>/
URL="https://le.imoons.cn/blog/${CATEGORY}-${SLUG}/"
MAX_RETRY=4
RETRY=0
while [ $RETRY -lt $MAX_RETRY ]; do
  sleep 3
  RETRY=$((RETRY + 1))
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "${URL}?_=$(date +%s%N)")
  if [ "$STATUS" = "200" ]; then
    echo "✅ 归档成功"
    echo "   文件: $FILE"
    echo "   URL:  $URL"
    echo "   用时: $((RETRY * 3))s"
    exit 0
  fi
done
echo "❌ HMR 失败（HTTP $STATUS, $((MAX_RETRY * 3))s 后仍 404），看 pm2 logs le-imoons-dev" >&2
exit 1
