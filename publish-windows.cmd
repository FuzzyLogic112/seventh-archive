@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles%\GitHub CLI;%PATH%"
echo.
echo 第七号档案 - 本机 GitHub 发布助手
echo.
where node >nul 2>&1
if errorlevel 1 goto need_tools
where gh >nul 2>&1
if errorlevel 1 goto need_tools
goto publish

:need_tools
echo 首次使用需要 Node.js 和 GitHub CLI。
where winget >nul 2>&1
if errorlevel 1 goto manual_install
choice /C YN /N /M "是否通过 Windows 官方 winget 安装缺少的组件？[Y/N] "
if errorlevel 2 goto finish
where node >nul 2>&1
if errorlevel 1 winget install --id OpenJS.NodeJS.LTS --exact --source winget
where gh >nul 2>&1
if errorlevel 1 winget install --id GitHub.cli --exact --source winget
where node >nul 2>&1
if errorlevel 1 goto install_incomplete
where gh >nul 2>&1
if errorlevel 1 goto install_incomplete
goto publish

:manual_install
echo 请先从官方网站安装下面两个工具：
echo Node.js：https://nodejs.org/
echo GitHub CLI：https://cli.github.com/
echo 安装完成后关闭此窗口，重新双击本文件。
goto finish

:install_incomplete
echo 组件尚未就绪。安装成功后请关闭此窗口，再双击本文件。
goto finish

:publish
node scripts\publish-github.mjs
if errorlevel 1 echo 请保留上面的错误信息，排除问题后可以重新运行。

:finish
echo.
pause
endlocal
