// 构建时 GitHub 数据抓取（仅在 astro build 的服务端执行，不会进入访客浏览器）
// - 令牌从环境变量 GITHUB_DATA_TOKEN 读取（Actions 里配置为仓库 Secret，前端不可见）
// - 抓取结果在构建阶段直接写入页面，访客端零 GitHub 请求，与限流彻底无关
// - 抓取失败时优雅降级（返回 null/空），构建不会失败，等待下一次定时构建自动恢复

const API = 'https://api.github.com';
const USER = 'Wojusensei';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = (import.meta.env.GITHUB_DATA_TOKEN as string | undefined) || '';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function gh<T = any>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: ghHeaders() });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function searchCount(query: string): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await gh<{ total_count: number }>(
      `/search/issues?per_page=1&q=${encodeURIComponent(query)}`,
    );
    if (r) return r.total_count;
    if (attempt === 0) await delay(700); // 被限流时稍等重试一次
  }
  return null;
}

export interface LangStat {
  name: string;
  bytes: number;
  others?: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  merged: boolean;
}

export interface GhStats {
  starsEarned: number | null;
  commits: number | null;
  prs: number | null;
  mergedPrs: number | null;
  issues: number | null;
  reviews: number | null;
  languages: LangStat[];
  cpythonPrs: PullRequest[];
  /** 上游高星仓库本体星数，key 为 owner/name */
  upstreamStars: Record<string, number>;
  /** 自有仓库星数，key 为仓库短名 */
  ownStars: Record<string, number>;
}

const EMPTY: GhStats = {
  starsEarned: null,
  commits: null,
  prs: null,
  mergedPrs: null,
  issues: null,
  reviews: null,
  languages: [],
  cpythonPrs: [],
  upstreamStars: {},
  ownStars: {},
};

export async function fetchGhStats(): Promise<GhStats> {
  const userRepos = await gh<any[]>(`/users/${USER}/repos?per_page=100&sort=updated`);
  if (!userRepos) return EMPTY; // 抓取失败：本轮构建降级，下一次定时构建自动恢复

  const own = userRepos.filter((r) => !r.fork);
  const ownStars: Record<string, number> = {};
  let starsEarned = 0;
  for (const r of own) {
    ownStars[r.name] = r.stargazers_count ?? 0;
    starsEarned += r.stargazers_count ?? 0;
  }

  // 语言占比：按各仓库 languages 字节求和（串行，避免瞬时并发）
  const langBytes: Record<string, number> = {};
  for (const r of own) {
    const langs = await gh<Record<string, number>>(`/repos/${r.full_name}/languages`);
    if (!langs) continue;
    for (const [name, bytes] of Object.entries(langs)) {
      langBytes[name] = (langBytes[name] ?? 0) + bytes;
    }
  }
  const languages: LangStat[] = Object.entries(langBytes)
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  // 搜索类统计：串行 + 失败重试一次
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
      const r = await gh<{ total_count: number }>(
        `/search/commits?per_page=1&q=${encodeURIComponent(`author:${USER}`)}`,
      );
      if (r) return r.total_count;
      if (attempt === 0) await delay(700);
    }
    return null;
  })();

  // cpython 的 PR 列表
  const cpythonSearch = await gh<{ items: any[] }>(
    `/search/issues?per_page=20&sort=created&q=${encodeURIComponent(
      `type:pr author:${USER} repo:python/cpython`,
    )}`,
  );
  const cpythonPrs: PullRequest[] = (cpythonSearch?.items ?? []).map((i) => ({
    number: i.number,
    title: i.title,
    url: i.html_url,
    merged: !!(i.pull_request?.merged_at),
  }));

  return {
    starsEarned,
    commits,
    prs,
    mergedPrs,
    issues,
    reviews,
    languages,
    cpythonPrs,
    upstreamStars: {},
    ownStars,
  };
}

// 上游高星仓库本体星数（如 python/cpython、nonebot/nonebot2）
export async function fetchUpstreamStars(
  fullNames: readonly string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const full of fullNames) {
    const r = await gh<{ stargazers_count: number }>(`/repos/${full}`);
    if (r) out[full] = r.stargazers_count ?? 0;
  }
  return out;
}
