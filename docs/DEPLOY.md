# GitHub 开源与部署指南

本项目已经提供网站文件、MIT 许可证和 GitHub Pages 工作流。发布时不需要购买服务器，也不需要配置数据库。

Windows 用户可以使用新加入的 [本机发布助手](DEPLOY-WINDOWS.md)：双击 `publish-windows.cmd`，在自己的浏览器授权后自动发布。以下仍保留手动上传步骤。

## 一、先在电脑上试玩

1. 把下载的 ZIP 完整解压，不要直接在压缩包里点开网页。
2. 进入 `seventh-archive/dist`。
3. 用 Chrome、Edge、Firefox 或 Safari 打开 `index.html`。
4. 点击“开始调查”，或直接点击房间中的光点。

如果希望使用本地网址，在装好 Node.js 22+ 后于项目根目录运行 `npm start`，访问 `http://localhost:4173`。项目没有需要安装的 npm 依赖。

## 二、创建公开仓库

登录 GitHub，创建一个新的 repository：

- Repository name：`seventh-archive`，或你喜欢的其他名称。
- Description：`原创中文密室逃脱游戏：场景探索、道具解谜、自动存档，纯前端零依赖。`
- Visibility：Public。
- 若采用下方命令上传，不要让 GitHub 预先生成 README、License 或 `.gitignore`；本项目已经提供这些文件。

公开仓库会向所有人展示代码和场景素材。确认上传的是本项目文件，不要额外放入个人资料或密钥。

## 三、上传源文件

可以通过 GitHub 网页的 Add file → Upload files 上传解压后的项目内容。不要只上传 ZIP：Pages 无法直接运行压缩包。

确认仓库首页有 `README.md`、`dist/`、`scripts/`、`tests/`、`package.json` 和 `.github/workflows/pages.yml`。如果你的文件管理器隐藏了 `.github` 文件夹，请通过 Git 命令上传，避免漏掉自动部署配置。

使用 Git 上传时，在解压后的项目根目录执行以下命令；把示例中的 `<你的用户名>` 替换成真实 GitHub 用户名。该示例适用于刚创建的空仓库。

```bash
git init -b main
git add .
git commit -m "feat: launch The Seventh Archive escape room"
git remote add origin https://github.com/<你的用户名>/seventh-archive.git
git push -u origin main
```

如果已存在 Git 仓库，先检查 `git status` 和 `git remote -v`，不要重复添加已有远程。身份验证使用 GitHub 的正常登录流程或 Git Credential Manager；不要把令牌写进项目文件。

## 四、开启 GitHub Pages

1. 打开仓库 **Settings → Pages**。
2. 找到 **Build and deployment → Source**，选择 **GitHub Actions**。
3. 打开仓库 **Actions** 页，选择 **Verify and deploy game to GitHub Pages**。
4. 点击 **Run workflow**，选择 `main`，再运行。
5. 等待 `verify` 和 `deploy` 两个任务都变绿。进入部署结果，复制 GitHub 返回的实际游戏地址。

如果首次上传时 Pages 尚未启用，第一次部署可能失败。启用后重新运行即可。后续每次推送到 `main` 都会自动重新部署。

工作流使用只读源码权限，并只在发布任务授予 `pages: write` 与 `id-token: write`；无需把个人访问令牌配置为仓库 Secret。Pull Request 只运行验证，不部署。

## 五、常见情况

| 情况 | 处理方式 |
| --- | --- |
| 图片或样式没有加载 | 确认 `dist/assets/`、`styles.css`、`engine.js`、`app.js` 全部上传；保持目录结构。 |
| Pages 提示未启用 | 回到 Settings → Pages，将 Source 切换到 GitHub Actions，重新运行工作流。 |
| 找不到 Actions 工作流 | 检查 `.github/workflows/pages.yml` 是否位于仓库根目录下。 |
| 打开页面出现 404 | 先确认发布任务成功，再使用部署结果返回的完整地址；项目仓库通常包含仓库名路径。 |
| 游戏进度变回起点 | 存档按浏览器和网站地址隔离；换浏览器、隐私模式、清除数据或更换域名都会影响存档。 |
| 国内访问不稳定 | 同一份 `dist/` 可以部署到你可用的静态托管服务或现有服务器；游戏自身没有海外运行接口依赖。 |

## 六、后续修改

在电脑修改文件后，先执行 `npm run check` 与 `npm test`，再提交并推送。工作流通过后，新版本会自动发布。

若修改谜题或存档结构，请同步更新 `engine.js` 中的 `VERSION` 以及 `app.js` 中的存档键，避免旧存档进入不兼容状态。

参考官方文档（2026-09-27 核对）：

- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
