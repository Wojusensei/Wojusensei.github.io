// 从 liquid.css 中切除指定类别的冗余规则（源码范围精确删除，不影响其余格式）
// 用法：node scripts/slim-apply.mjs c1   → 删除与 global.css 选择器完全相同的逐字重复
//       node scripts/slim-apply.mjs c2   → 删除 html 前缀等价重复
import * as csstree from 'css-tree';
import { readFile, writeFile } from 'node:fs/promises';

const category = process.argv[2] ?? 'c1';
// 回归实测发现会改变手机端渲染的 C2 规则（html 前缀在此压过 global 的移动端媒体查询，属于承重墙）
const C2_KEEP = new Set([
  'html .logo',
  'html .hero-main',
  'html .hero-copy',
  '(max-width:760px)||html .site-header',
  '(max-width:760px)||html .section',
]);
const src = await readFile('public/skins/liquid.css', 'utf8');
const globalSrc = await readFile('src/styles/global.css', 'utf8');

function parse(src, withPositions) {
  const ast = csstree.parse(src, { positions: withPositions });
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
        rules.push({
          media, selector, decls,
          start: withPositions ? node.loc.start.offset : 0,
          end: withPositions ? node.loc.end.offset : 0,
        });
      } else if (node.type === 'Atrule' && node.name === 'media' && node.block) {
        walkBlock(node.block.children, csstree.generate(node.prelude).trim());
      }
    }
  };
  walkBlock(ast.children, '');
  return rules;
}

const specificity = (sel) => {
  const s = sel.replace(/::[a-z-]+/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/[.[]|:not\(|:[a-z-]+/g) || []).length;
  const types = (s.match(/(^|[\s>+~])([a-z]+[\w-]*)/gi) || []).length;
  return [ids, classes, types];
};
const normDecls = (m) => [...m.entries()].map(([k, v]) => `${k}:${v.replace(/\s+/g, ' ')}`).sort().join(';');
const stripHtmlPrefix = (s) => s.replace(/^html\s+/, '').replace(/\s+html(\s|$)/g, ' ').trim();

const liquid = parse(src, true);
const global = parse(globalSrc, false);
const globalIndex = new Map();
for (const r of global) {
  const key = `${r.media}||${normDecls(r.decls)}`;
  (globalIndex.get(key) ?? globalIndex.set(key, []).get(key)).push(r);
}

const ranges = [];
for (const r of liquid) {
  const stripped = stripHtmlPrefix(r.selector);
  const prefixed = stripped !== r.selector;
  const candidates = globalIndex.get(`${r.media}||${normDecls(r.decls)}`) ?? [];
  const hit = !prefixed && candidates.some((g) => g.selector === r.selector)
    ? 'c1'
    : prefixed && candidates.some((g) => g.selector === stripped) ? 'c2' : null;
  if (hit !== category) continue;
  if (category === 'c2' && (C2_KEEP.has(r.selector) || C2_KEEP.has(`${r.media}||${r.selector}`))) continue;
  ranges.push([r.start, r.end]);
}
ranges.sort((a, b) => a[0] - b[0]);
// 合并区间，并吃掉规则后的缩进换行，避免留下一串空行
const merged = [];
for (const [s, e] of ranges) {
  let [ms, me] = [s, e];
  let k = me;
  while (k < src.length && (src[k] === '\n' || src[k] === ' ')) k++;
  if (src[k - 1] === '\n') me = k; else me = k - (k - me > 0 ? 0 : 0);
  if (merged.length && ms <= merged[merged.length - 1][1]) merged[merged.length - 1][1] = me;
  else merged.push([ms, me]);
}
let out = src;
for (let i = merged.length - 1; i >= 0; i--) {
  const [s, e] = merged[i];
  out = out.slice(0, s) + out.slice(e);
}
await writeFile('public/skins/liquid.css', out);
console.log(`${category}: 删除 ${ranges.length} 条规则`);
