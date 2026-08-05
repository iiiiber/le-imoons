#!/usr/bin/env python3
"""
中英混合标题 → slug
用法: echo "周末长沙散步" | python3 to_slug.py
输出: zhou-mo-chang-sha-san-bu

优先级:
  1. 抽出英文/数字 → 短横线连接
  2. 中文 → pypinyin 首字母
  3. 兜底 → 日期戳 post-MMDD-HHMM
"""
import sys
import re
import datetime

try:
    from pypinyin import lazy_pinyin
except ImportError:
    print("⚠️  pypinyin 未安装, 试装...", file=sys.stderr)
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'pypinyin', '-q'], check=True)
    from pypinyin import lazy_pinyin


def to_slug(title: str) -> str:
    title = title.strip()
    # 1. 抽出英文/数字 (按出现顺序, 小写)
    eng = re.findall(r'[a-zA-Z0-9]+', title)
    if eng:
        return '-'.join(e.lower() for e in eng)
    # 2. 中文 → pypinyin 全拼 (不用首字母, 避免 z-m-c-s 那种看不懂的)
    pinyin = lazy_pinyin(title)
    full = '-'.join(p for p in pinyin if p)
    if len(full) >= 3:
        return full
    # 3. 兜底
    return f"post-{datetime.datetime.now().strftime('%m%d-%H%M')}"


if __name__ == '__main__':
    if not sys.stdin.isatty():
        title = sys.stdin.read().strip()
    elif len(sys.argv) > 1:
        title = sys.argv[1]
    else:
        print("用法: echo '标题' | python3 to_slug.py", file=sys.stderr)
        print("    python3 to_slug.py '标题'", file=sys.stderr)
        sys.exit(1)
    if not title:
        print("❌ 标题为空", file=sys.stderr)
        sys.exit(1)
    print(to_slug(title))
