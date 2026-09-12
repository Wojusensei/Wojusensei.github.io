// 友链数据：一个条目 = 一位小伙伴
// 获得对方同意后，在这里加一条即可上榜
// avatar：页面引用的本地缓存路径（scripts/fetch-friend-avatars.mjs 构建时把 avatarSrc 抓到 public/friends/，文件名取 URL 最后一段）
// avatarSrc：抓取源（构建时刷新，线上由 6 小时定时构建保持最新；本地开发直接用仓库里的缓存文件）
// shot：卡片底图蒙版 —— 对方网站首页截图（public/friends/shots/，50% 透明铺在玻璃卡片上便于一眼区分）
//       新增友链时：截一张对方站点首页图 → 压到 800px 宽的 jpg 放进 shots/ → 这里填路径
export const friends = [
  {
    name: '帕秋莉·阿希欧姆',
    url: 'https://patchouli-cn.github.io',
    desc: '一个帕琪厨，车万人，欢迎各位！',
    avatar: '/friends/patchouli-cn.jpg',
    avatarSrc: 'https://github.com/patchouli-cn.png',
    shot: '/friends/shots/patchouli-cn.webp',
  },
  {
    name: 'shotamiao',
    url: 'https://shotamiao.online',
    desc: '在代码、网络安全和游戏间穿梭的普通人。近期正埋头于计算机科学基础与线性代数。',
    avatar: '/friends/shotamiao.jpg',
    avatarSrc: 'https://origin.picgo.net/2026/07/14/Image_1779620623863_953cf3666e3dac54e88.jpg',
    shot: '/friends/shots/shotamiao.webp',
  },
] as const;
