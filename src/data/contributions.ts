// 「贡献」板块配置：贡献过的高星仓库（100+ star）
// prRepo 用于在对应仓库里搜索该站长的 PR；plugins 为生态插件列表（star 数实时拉取）
// fallbackPrs：搜索接口限流时的静态兜底（真实 PR，实时数据可用时会被覆盖）
export const contributions = {
  repos: [
    {
      repo: 'python/cpython',
      note: 'Python 官方解释器仓库',
      noteEn: 'The official Python interpreter repository',
      fallbackPrs: [
        {
          number: 153263,
          title: 'gh-152798: update sys.thread_info.lock documentation to match implementation',
          url: 'https://github.com/python/cpython/pull/153263',
          merged: true,
        },
      ],
    },
    {
      repo: 'nonebot/nonebot2',
      note: 'NoneBot2 跨平台机器人框架',
      noteEn: 'Cross-platform bot framework for NoneBot2',
      plugins: [
        'nonebot-plugin-group-heat',
        'nonebot-plugin-group-historian',
        'nonebot-plugin-helper-recall',
        'nonebot-plugin-bili-query',
        'nonebot-plugin-bilidownloader-woju',
      ],
    },
  ],
} as const;
