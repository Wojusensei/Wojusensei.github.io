// 「贡献」板块数据层：从 GitHub 公开接口实时拉取统计数据并本地缓存
// - 匿名搜索接口限流 10 次/分钟：全部请求串行 + 失败重试一次，避免并发触发 429
// - Star 总数 / 语言占比：仓库列表 + 各仓库 languages 字节统计
// - 全部结果缓存 1 小时（v2）；接口失败时回退缓存，再失败由页面显示占位
import { site } from '../data/site';

export interface ContribStats {
  prs: number | null;
  mergedPrs: number | null;
  issues: number | null;
  reviews: number | null;
  commits: number | null;
  starsEarned: number | null;
  languages: { name: string; bytes: number }[];
  cpythonPrs: { number: number; title: string; url: string; merged: boolean }[];
}

const CACHE_KEY = 'woju-contrib-stats-v2';
const TTL = 60 * 60 * 1000;
const USER = 'Wojusensei';
const API = 'https://api.github.com';
const JSON_HEADERS = { Accept: 'application/vnd.github+json' };

// 带上只读令牌：匿名 60 次/小时/IP → 5,000 次/小时
function ghHeaders(): Record<string, string> {
  return site.githubToken
    ? { ...JSON_HEADERS, Authorization: `Bearer ${site.githubToken}` }
    : { ...JSON_HEADERS };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readCache(allowStale = false): ContribStats | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '');
    const ageOk = c?.ts && Date.now() - c.ts < TTL;
    if (c?.stats && (ageOk || allowStale)) return c.stats;
  } catch { /* 无缓存 */ }
  return null;
}

function writeCache(stats: ContribStats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), stats }));
  } catch { /* 存储失败忽略 */ }
}

async function ghJSON(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: ghHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function searchCount(query: string): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await ghJSON(`${API}/search/issues?per_page=1&q=${encodeURIComponent(query)}`);
    if (r) return r.total_count as number;
    if (attempt === 0) await delay(700); // 被限流时稍等重试一次
  }
  return null;
}

export interface StatsResult {
  stats: ContribStats | null;
  fromCache: boolean;
}

export async function loadContribStats(): Promise<StatsResult> {
  const cached = readCache();
  if (cached) return { stats: cached, fromCache: true };

  const userRepos = await ghJSON(`${API}/users/${USER}/repos?per_page=100&sort=updated`);
  if (!userRepos) {
    // 限流/断网：回退到上次成功的统计数据（哪怕略旧），不让面板空掉
    return { stats: readCache(true), fromCache: true };
  }
  const own = userRepos.filter((r: any) => !r.fork);

  const starsEarned = own.reduce((s: number, r: any) => s + (r.stargazers_count ?? 0), 0);

  // 语言占比：按各仓库 languages 字节求和（串行，避免瞬时并发）
  const langBytes: Record<string, number> = {};
  for (const r of own) {
    const langs = await ghJSON(`${API}/repos/${r.full_name}/languages`);
    if (!langs) continue;
    for (const [name, bytes] of Object.entries(langs)) {
      langBytes[name] = (langBytes[name] ?? 0) + (bytes as number);
    }
  }
  const languages = Object.entries(langBytes)
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  // 搜索类统计：串行 + 重试，降低触发匿名限流的概率
  const prs = await searchCount(`type:pr author:${USER}`);
  await delay(350);
  const mergedPrs = await searchCount(`type:pr author:${USER} is:merged`);
  await delay(350);
  const issues = await searchCount(`type:issue author:${USER}`);
  await delay(350);
  const reviews = await searchCount(`type:pr reviewed-by:${USER}`);
  await delay(350);
  const commits = await (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await ghJSON(`${API}/search/commits?per_page=1&q=${encodeURIComponent(`author:${USER}`)}`);
      if (r) return r.total_count as number;
      if (attempt === 0) await delay(700);
    }
    return null;
  })();

  // cpython 的 PR 列表（失败时由页面回退到静态数据）
  const cpythonSearch = await ghJSON(
    `${API}/search/issues?per_page=20&sort=created&q=${encodeURIComponent(`type:pr author:${USER} repo:python/cpython`)}`,
  );
  const cpythonPrs = (cpythonSearch?.items ?? []).map((i: any) => ({
    number: i.number as number,
    title: i.title as string,
    url: i.html_url as string,
    merged: !!(i.pull_request?.merged_at),
  }));

  const stats: ContribStats = {
    prs,
    mergedPrs,
    issues,
    reviews,
    commits,
    starsEarned,
    languages,
    cpythonPrs,
  };
  writeCache(stats);
  return { stats, fromCache: false };
}

// 生态插件 star 数（与作品页共用一份缓存；接口失败回退旧数据）
export async function loadPluginStars(repos: readonly string[]): Promise<Record<string, number>> {
  const cacheKey = 'woju-stars';
  let cached: { map: Record<string, number> } | null = null;
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey) || '');
    if (c?.map) cached = c;
  } catch { /* 重新拉取 */ }
  if (cached && Date.now() - (cached as any).ts < 30 * 60 * 1000) return cached.map;

  const map: Record<string, number> = {};
  const list = await ghJSON(`${API}/users/${USER}/repos?per_page=100`);
  if (!list) return cached ? cached.map : map; // 失败：用旧数据
  for (const r of list) map[r.name] = r.stargazers_count;
  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), map }));
  return map;
}
