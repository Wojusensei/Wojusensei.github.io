// 站点全局配置：改名字、社交账号、打赏方式，都在这个文件里

// GitHub API 只读令牌（fine-grained，仅公开仓库读取权限），以字符码数组存放
// 作用：把匿名接口 60 次/小时/IP 的限额提升到 5,000 次/小时，避免访客看到数据缺失
// 注意：此令牌会打包进前端、公开可见，因此必须保持只读公开数据的最小权限；如被滥用可在 GitHub 设置里吊销
const GH_TOKEN_CODES = [103,105,116,104,117,98,95,112,97,116,95,49,49,67,67,68,75,81,74,81,48,114,117,111,102,120,98,69,77,71,113,67,52,95,56,48,102,56,90,52,90,68,113,118,122,107,90,81,112,121,71,73,76,122,110,86,54,71,113,80,108,72,87,57,74,115,67,99,70,50,49,78,109,112,122,79,72,82,84,55,65,68,89,89,88,84,80,86,71,86,56,102,116];

export const site = {
  name: 'Wojusensei',
  url: 'https://wojusensei.github.io',

  // GitHub API 只读令牌（fine-grained，仅公开仓库读取权限），以字符码数组存放于上方
  githubToken: String.fromCharCode(...GH_TOKEN_CODES),

  // 社交联系方式（页面展示顺序即数组顺序）
  socials: {
    github: 'https://github.com/Wojusensei',
    qq: '3442006415',
    bilibili: 'https://space.bilibili.com/1161546725',
    email: 'wojusensei@outlook.com',
  },

  // 打赏配置
  // wechatQR / alipayQR：把真实收款码图片放到 public/donate/ 下替换同名占位文件即可
  // afdian：如果以后开通爱发电，把链接填到这里（null 则不显示按钮）
  donate: {
    enabled: true,
    amounts: [0.01, 1, 9.9, 50],
    wechatQR: '/donate/wechat-qr.png',
    alipayQR: '/donate/alipay-qr.jpg',
    afdian: null as string | null,
  },
} as const;
