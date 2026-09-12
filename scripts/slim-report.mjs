// 液态皮肤瘦身比对：找出 liquid.css 中可由 global.css 承担的冗余规则
// 用法：node scripts/slim-report.mjs
import * as csstree from 'css-tree';
import { readFile } from 'node:fs/promises';

const liquidSrc = await readFile('public/skins/liquid.css', 'utf8');
const globalSrc = await readFile('src/styles/global.css', 'utf8');

// 解析：返回 [{ media, selector, decls: Map(prop->value), raw }]
function parse(src) {
  const ast = csstree.parse(src);
  const rules = [];
  const walkBlock = (list, media) => {
    for (const node of list) {
      if (node.type === 'Rule') {
        const selector = csstree.generate(node.prelude).trim();
        const decls = new Map();
        for (const d of node.block.children) {
          if (d.type !== 'Declaration' || d.value === null) continue;
          let v = csstree.generate(d.value).trim();
          if (d.important) v += ' !important';
          decls.set(d.property.toLowerCase(), v);
        }
        rules.push({ media, selector, decls, node });
      } else if (node.type === 'Atrule' && node.name === 'media' && node.block) {
        walkBlock(node.block.children, csstree.generate(node.prelude).trim());
      }
    }
  };
  walkBlock(ast.children, '');
  return rules;
}

// 粗略特异性：(id, class/attr/pseudo-class, type)
function specificity(sel) {
  let ids = 0, classes = 0, types = 0;
  const s = sel.replace(/::[a-z-]+/g, ''); // 伪元素按类型算，简化
  ids = (s.match(/#[\w-]+/g) || []).length;
  classes = (s.match(/[.[]|:not\(|:[a-z-]+/g) || []).filter(Boolean).length;
  types = (s.match(/(^|[\s>+~])([a-z]+[\w-]*)/gi) || []).length;
  return [ids, classes, types];
}
const cmpSpec = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
const normDecls = (m) => [...m.entries()].map(([k, v]) => `${k}:${v.replace(/\s+/g, ' ')}`).sort().join(';');
const stripHtmlPrefix = (s) => s.replace(/^html\s+/, '').replace(/\s+html(\s|$)/g, ' ').trim();

const liquid = parse(liquidSrc);
const global = parse(globalSrc);
const globalIndex = new Map(); // media + normDecls -> [rules]
for (const r of global) {
  const key = `${r.media}||${normDecls(r.decls)}`;
  (globalIndex.get(key) ?? globalIndex.set(key, []).get(key)).push(r);
}

const c1 = []; // 选择器与 global 完全一致 + 声明逐字相同 → 直接删
const c2 = []; // 液态是 html 前缀、去前缀后与 global 选择器一致 + 声明相同 → 审查后删
const diff = []; // 选择器对应但声明有差异 → 保留（皮肤刻意差异）
for (const r of liquid) {
  const stripped = stripHtmlPrefix(r.selector);
  const prefixed = stripped !== r.selector;
  const key = `${r.media}||${normDecls(r.decls)}`;
  const candidates = globalIndex.get(key) ?? [];
  const exact = candidates.find((g) => g.selector === r.selector);
  const equiv = candidates.find((g) => g.selector === stripped && specificity(stripped) >= specificity(g.selector) - 0 || g.selector === stripped);
  if (exact && !prefixed) c1.push(r);
  else if (candidates.length && equiv) c2.push({ ...r, stripped });
  else {
    // 选择器（去前缀）一致但声明不同 → 刻意差异
    const same = global.filter((g) => g.media === r.media && g.selector === stripped);
    if (same.length && prefixed) diff.push({ liquid: r, global: same });
  }
}

const fmt = (r) => `${r.media ? `[${r.media}] ` : ''}${r.selector} { ${normDecls(r.decls).split(';').filter(Boolean).join('; ')} }`;
console.log(`=== C1 与 global 逐字相同（候选删除：${c1.length} 条）===`);
c1.forEach((r) => console.log(fmt(r)));
console.log(`\n=== C2 html 前缀等价重复（候选删除：${c2.length} 条）===`);
c2.forEach((r) => console.log(fmt(r)));
console.log(`\n=== 保留：选择器对应但声明有差异（${diff.length} 组）===`);
diff.forEach((d) => {
  console.log('液态:', fmt(d.liquid));
  d.global.forEach((g) => console.log('  毛玻璃:', fmt(g)));
});
