// 站点全局配置：改名字、社交账号、打赏方式，都在这个文件里
export const site = {
  name: 'Wojusensei',
  url: 'https://wojusensei.github.io',

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
