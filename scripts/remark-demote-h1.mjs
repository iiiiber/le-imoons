// rehype 插件: 把 markdown 第一行 # 标题降级为 h2, 标记为原 h1
// 原因: 文章页 hero 区域已经渲染 h1, markdown 里再写 # 就是重复
// 副作用: demote 后的 h1 现在 depth=2, 跟原 h2 混在一起 - 用 data 属性区分
import { visit } from 'unist-util-visit';

export function rehypeDemoteH1() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h1') {
        node.tagName = 'h2';
        node.properties = node.properties || {};
        // 标记是从 h1 降级来的, 模板里过滤掉
        const cls = Array.isArray(node.properties.className)
          ? node.properties.className
          : node.properties.className
            ? [node.properties.className]
            : [];
        cls.push('demoted-from-h1');
        node.properties.className = cls;
      }
    });
  };
}
