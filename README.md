# Wojusensei.github.io

个人主页 + 博客：Astro + WebGL 液态玻璃渲染 + Matter.js 物理引擎。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产物在 dist/
npm run preview
```

## 发布

推送到 `main` 分支后，GitHub Actions（`.github/workflows/deploy.yml`）自动构建并部署到 GitHub Pages。
首次使用需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 常用修改入口

| 想改什么 | 文件 |
| --- | --- |
| 站点名、社交账号、打赏码、giscus 配置 | `src/data/site.ts` |
| 作品卡片 | `src/data/works.ts` |
| 中英文案 | `src/i18n/ui.ts` |
| 文章（Markdown） | `src/content/blog/` |
| 亮暗配色 / 卡片样式 | `src/styles/global.css` |
| 玻璃渲染参数（折射/高光/色散强度） | `src/lib/glass/engine.ts`（着色器） |
| 物理参数（数量/弹性/游走） | `src/lib/glass/physics.ts` |

## 打赏码替换

把微信「赞赏码」（微信 → 收付款 → 赞赏码）和支付宝「收款码」截图放进 `public/donate/`，
替换 `wechat-qr.svg` / `alipay-qr.svg`（或改用 png，同步改 `src/data/site.ts` 里的文件名）。

## 评论

当前未启用评论。如需恢复，推荐 utterances（基于 GitHub Issues，无需服务器），详见 `docs/博客写作指南.md`。
