// 主题（亮/暗）与语言（中/英）切换逻辑
// 主题：html[data-theme]，localStorage 持久化，head 内联脚本防闪烁（见 Base.astro）
// 语言：data-i18n / data-i18n-list / data-i18n-attr 驱动，localStorage 持久化

import { getT, type Locale } from '../i18n/ui';

const THEME_KEY = 'woju-theme';
const LANG_KEY = 'woju-lang';

export function initTheme() {
  const apply = (dark: boolean, animate: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    if (animate) window.dispatchEvent(new CustomEvent('woju-theme', { detail: { dark } }));
  };
  const btn = document.getElementById('theme-toggle');
  btn?.addEventListener('click', () => {
    apply(document.documentElement.dataset.theme !== 'dark', true);
  });
}

export function currentLocale(): Locale {
  return (localStorage.getItem(LANG_KEY) as Locale) || 'zh';
}

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o != null ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function applyLocale(locale: Locale) {
  const t = getT(locale);
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  localStorage.setItem(LANG_KEY, locale);

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const v = get(t, el.dataset.i18n!);
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-list]').forEach((el) => {
    const v = get(t, el.dataset.i18nList!);
    if (Array.isArray(v)) {
      el.replaceChildren(
        ...v.map((item) => {
          const span = document.createElement(el.children[0]?.tagName || 'span');
          span.className = (el.children[0] as HTMLElement)?.className || '';
          span.textContent = item;
          return span;
        }),
      );
    }
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    // 格式：attr:key，如 aria-label:misc.themeToggle
    const [attr, key] = el.dataset.i18nAttr!.split(':');
    const v = get(t, key!);
    if (typeof v === 'string') el.setAttribute(attr!, v);
  });

  // 构建时烘焙的双语片段（如 PR 徽章、仓库描述）：跟随语言切换显示
  const en = locale === 'en';
  document.querySelectorAll<HTMLElement>('[data-lang-zh]').forEach((el) => {
    el.style.display = en ? 'none' : '';
  });
  document.querySelectorAll<HTMLElement>('[data-lang-en]').forEach((el) => {
    el.style.display = en ? '' : 'none';
  });

  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = locale === 'zh' ? 'EN' : '中文';

  window.dispatchEvent(new CustomEvent('woju-lang', { detail: { locale } }));
}

export function initLang() {
  applyLocale(currentLocale());
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    applyLocale(currentLocale() === 'zh' ? 'en' : 'zh');
  });
}
