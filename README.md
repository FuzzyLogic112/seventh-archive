# 第七号档案 · The Seventh Archive

一封没有署名的邀请，一间午夜上锁的档案室。观察旧物，收集道具，找回第七份档案，带着它离开。

中文点击式密室逃脱游戏，原生 HTML / CSS / JavaScript，无框架、无第三方运行依赖、无后端。源码采用 MIT 许可证，支持 GitHub Pages 静态部署。

![游戏界面](docs/preview.jpg)

## 立即游玩

**[在线试玩：第七号档案 · 午夜密室](https://fuzzylogic112.github.io/seventh-archive/)**

用电脑或手机浏览器直接打开即可，无需注册。游戏进度自动保存在当前浏览器。

也可以下载源码包并解压，双击 `dist/index.html` 即可开始。无需安装 Node.js，也无需启动服务器。

若希望稳定保存进度，建议使用下面的本地 HTTP 服务或已部署的网站。不同浏览器对 `file://` 页面存储的处理有所不同。

```bash
npm start
```

浏览器访问 `http://localhost:4173`。运行开发服务和测试需要 Node.js 22 或以上，无需 `npm install`。

## 玩法

- 七个可调查物件，五道相互关联的机关，一条完整逃脱流程。
- 收集钥匙、紫外线手电、保险丝，在对应位置使用。
- 线索自动进入手记，三级提示按需展开，重复查看不重复计数。
- 自动保存当前浏览器的进度；页面隐藏时暂停计时，没有失败倒计时。
- 可开关环境雨声，由浏览器 Web Audio 实时生成，默认静音。
- 适配电脑和手机；画面下方有物件名称，可替代点击小光点。
- 键盘可用：Tab 导航、Enter 操作、Esc 关闭调查窗口。

这是单章节、固定谜题的完整可玩版本。存档仅在当前浏览器中保存，不包含账号、云存档、多人联机或在线排行榜。

## 发布到 GitHub Pages

Windows 用户可双击项目根目录的 `publish-windows.cmd`，在自己的浏览器完成登录后，由发布工具创建公开仓库、上传源码并开启 Pages。具体说明见 [Windows 本机发布指南](docs/DEPLOY-WINDOWS.md)。不需要云浏览器。

完整的新手步骤见 [部署指南](docs/DEPLOY.md)。

1. 在 GitHub 新建公开仓库，例如 `seventh-archive`。
2. 把项目文件提交到 `main` 分支，保留 `.github/workflows/pages.yml`。
3. 打开仓库 **Settings → Pages**，将 **Source** 设为 **GitHub Actions**。
4. 打开 **Actions → Verify and deploy game to GitHub Pages → Run workflow**。
5. 工作流先校验资源、执行测试，再发布 `dist/`。成功后的真实地址显示在该次运行的部署结果中。

所有资源使用相对路径，项目仓库的子路径也能正确加载。工作流只上传 `dist/`，不会把源码文档和测试发布到游戏站点。

GitHub Pages 的网络可达性由用户网络决定；游戏资源不依赖外部 CDN、在线字体或 API。需要使用其他静态主机时，直接上传整个 `dist/` 即可。

## 开发与验证

```bash
npm run check
npm test
npm run dev
```

| 文件 | 用途 |
| --- | --- |
| `dist/index.html` | 游戏主界面和语义结构 |
| `dist/styles.css` | 主题、响应式布局和动效 |
| `dist/engine.js` | 纯状态机、机关规则、存档校验和提示 |
| `dist/app.js` | 场景交互、道具选择、手记、声音和计时 |
| `dist/assets/archive-room.webp` | 随项目提供的档案室背景 |
| `scripts/serve.mjs` | 无依赖本地开发服务 |
| `scripts/check.mjs` | 资源引用和 JavaScript 语法检查 |
| `tests/engine.test.cjs` | 完整通关、无效操作和存档恢复测试 |
| `.github/workflows/pages.yml` | 自动验证与 GitHub Pages 发布 |

规则和界面分离。增加机关时，在 `engine.js` 中添加状态、动作、提示与依赖，再在 `app.js` 中添加调查窗口，并补充可达性测试。调整场景坐标时，修改 `targets` 中相对图片宽高的百分比；不要改变图片比例，否则光点会偏移。

源码包含解谜答案，因为规则完全运行在浏览器中。它适合休闲解谜和前端学习，不应被用作有奖金的防作弊竞赛。

## 素材与许可

代码使用 [MIT License](LICENSE)。场景图片为本项目通过 AI 生成的原创场景素材；来源说明与项目内使用许可见 [ASSETS.md](ASSETS.md)。项目不包含第三方照片、字体、付费音频或 API 密钥。

欢迎提交问题、修复和新章节。贡献前请运行 `npm run check` 和 `npm test`，并确认手机布局及完整逃脱流程没有中断。
