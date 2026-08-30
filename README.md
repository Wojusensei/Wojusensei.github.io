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
