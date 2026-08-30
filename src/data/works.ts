// 精选作品数据：描述取自各仓库 README / GitHub 简介，可随时修改补充
// repo: GitHub 仓库名；repos: 多仓库聚合（如插件合集，star 数取总和）；
// icon 已按无 emoji 要求移除
export interface Work {
  repo: string;
  name: string;
  desc: string;
  descEn: string;
  tags: string[];
  repos?: string[];
  featured?: boolean;
}

export const works: Work[] = [
  {
    repo: 'GitSync',
    name: 'GitSync',
    desc: '交互式 Git 历史浏览器，在 git 之上加入更多便捷功能：可视化提交图、Diff、Blame 等等。',
    descEn:
      'An interactive Git history browser with extra conveniences on top of git: visual commit graph, Diff, Blame and more.',
    tags: ['TypeScript', 'Git', 'Desktop'],
    featured: true,
  },
  {
    repo: 'woGAer',
    name: 'woGAer',
    desc: '高性能本地桌面工具，用于自动化 GitHub Actions 打包流程。',
    descEn:
      'A high-performance local desktop tool for automating GitHub Actions packaging.',
    tags: ['JavaScript', 'Automation', 'Desktop'],
    featured: true,
  },
  {
    repo: 'media-downloader',
    name: 'media-downloader',
    desc: '多语言实现的 bilibili 视频 / 音频 / 封面下载器。',
    descEn:
      'Multi-language downloader for bilibili videos, audio and covers.',
    tags: ['Go', 'Python', 'CLI'],
    featured: true,
  },
  {
    repo: 'api-debugger',
    name: 'api-debugger',
    desc: '轻量级的本地优先 API 调试工具，Python × Rust，多线程并发，代理速度接近原生 HTTP 库。',
    descEn:
      'A lightweight local-first API debugging tool in Python × Rust with multithreaded concurrency.',
    tags: ['Rust', 'Python', 'Tooling'],
    featured: true,
  },
  {
    repo: 'error-translator',
    name: 'error-translator',
    desc: '多语言错误信息翻译器：粘贴一段报错，得到人话解释。',
    descEn: 'Paste an error, get a plain-language explanation — in multiple languages.',
    tags: ['HTML', 'i18n'],
    featured: true,
  },
  {
    repo: 'frp-manager',
    name: 'frp-manager',
    desc: '本地服务穿透内网自动生成公网地址，不需要公网 IP。',
    descEn: 'Expose local services through NAT and get a public URL — no public IP needed.',
    tags: ['Python', 'Network'],
    featured: true,
  },
  {
    repo: 'nonebot-plugin-group-heat',
    name: 'NoneBot 插件系列',
    desc: '群热度统计、话痨榜、消息神权撤回、B 站查询与下载……一组 NoneBot2 QQ 群机器人插件（group-heat / group-historian / helper-recall / bili-query / bilidownloader）。',
    descEn:
      'A family of NoneBot2 plugins for QQ groups: group heat stats, chatter rankings, recall helper, bilibili query & download.',
    tags: ['Python', 'NoneBot2', 'QQ Bot'],
    repos: [
      'nonebot-plugin-group-heat',
      'nonebot-plugin-group-historian',
      'nonebot-plugin-helper-recall',
      'nonebot-plugin-bili-query',
      'nonebot-plugin-bilidownloader-woju',
    ],
  },
];
