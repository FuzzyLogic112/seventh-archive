# 在自己的 Windows 电脑发布

这个发布工具使用你自己的浏览器和 GitHub CLI 登录，不需要 ChatGPT 云浏览器。登录授权完成后，它会创建公开仓库、上传项目、开启 GitHub Pages、等待测试和部署，并显示 GitHub 返回的实际游戏网址。

## 操作步骤

1. 下载最新版源码 ZIP，完整解压，进入 `seventh-archive` 文件夹。
2. 双击根目录的 `publish-windows.cmd`。
3. 如果缺少 Node.js 或 GitHub CLI，按提示安装。安装器显示协议或系统确认时，由你自行查看并决定。
4. 登录时按终端提示，在自己的浏览器完成 GitHub 授权。登录信息由 GitHub CLI 处理，无需发送到聊天中。
5. 确认窗口显示的是你的 GitHub 账号。仓库名默认为 `seventh-archive`，按回车使用，也可输入其他英文名称。
6. 保持窗口打开，等待上传和部署完成。只有工作流成功后，工具才会显示“GitHub 已报告部署成功”。

成功后会打开游戏网站，并在项目目录写入 `PUBLISH-RESULT.txt`，保存仓库链接、网站链接和工作流链接。

## 安装与命令方式

需要 Node.js 22 或更新版本、GitHub CLI。不需要 Git，也不需要运行 `npm install`。

如果双击方式未能安装依赖，可在 Windows 终端执行：

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id GitHub.cli --exact --source winget
```

安装完成后重新打开终端，进入项目文件夹：

```powershell
node scripts/publish-github.mjs
```

macOS 或 Linux 安装 Node.js 和 GitHub CLI 后，也可运行同一条 Node.js 命令。

## 出错后继续

- **仓库名称已被占用：** 工具不会修改已有的陌生仓库。重新运行，换一个名称即可。
- **授权缺少 workflow 权限：** 在本机运行 `gh auth refresh --hostname github.com --scopes workflow`，按提示授权，再运行发布工具。
- **网络中断：** 保留项目内的 `.publish-state.json`，重新运行会根据已记录的仓库继续，不会删除远程内容。
- **其他人修改了 main 分支：** 工具会停止，避免覆盖。请先查看仓库里的改动。
- **工作流失败：** 打开窗口显示的工作流链接，查看失败步骤。工具不会把失败误报为网站上线。
- **工作流成功但网址暂时打不开：** 可能是本机网络或站点生效延迟。保留最终网址，再尝试访问。

工具只上传代码中列明的项目文件，不会递归上传整个电脑目录。`.publish-state.json` 只记录目标仓库、提交和部署状态，不含登录令牌；它与结果文件均已被 Git 忽略。

本工具已经完成本地文件检查和保护逻辑测试，但尚未使用你的 GitHub 账号实际运行。真正的公开仓库与在线地址将在你本机完成授权并发布成功后生成。

官方参考：

- [GitHub CLI 登录](https://cli.github.com/manual/gh_auth_login)
- [GitHub CLI 安装](https://github.com/cli/cli#installation)
- [GitHub Pages API](https://docs.github.com/en/rest/pages/pages)
