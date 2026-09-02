// 友链数据：一个条目 = 一位小伙伴
// 获得对方同意后，在这里加一条即可上榜
// avatar：页面引用的本地缓存路径（scripts/fetch-friend-avatars.mjs 构建时把 avatarSrc 抓到 public/friends/，文件名取 URL 最后一段）
// avatarSrc：抓取源（构建时刷新，线上由 6 小时定时构建保持最新；本地开发直接用仓库里的缓存文件）
export const friends = [
  {
    name: '帕秋莉·阿希欧姆',
    url: 'https://patchouli-cn.github.io',
    desc: '一个帕琪厨，车万人，欢迎各位！',
    avatar: '/friends/patchouli-cn.jpg',
    avatarSrc: 'https://github.com/patchouli-cn.png',
  },
] as const;
