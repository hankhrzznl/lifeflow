@echo off
chcp 65001 >nul
setlocal
title LifeFlow 部署到 Vercel + 你的域名

set "APPDIR=C:\还原自备份\hankkk\lifeflow-unified\app-v2"
set "VERCEL=%APPDATA%\npm\vercel.cmd"

echo ============================================================
echo   LifeFlow - 部署到 Vercel，并挂你的域名
echo ============================================================
echo.
echo   这个脚本做三件事：
echo     1. 让你登录 Vercel（会开浏览器，需要你点一下授权）
echo     2. 把 app-v2 部署到 Vercel（生产环境）
echo     3. 打印部署地址，并告诉你怎么挂自己的域名
echo.
echo   为什么必须你本人登录：
echo     这台机器上的 Vercel 凭据已失效（token invalid），
echo     登录需要浏览器授权，AI 替不了你。
echo ============================================================
echo.
pause

if not exist "%VERCEL%" (
  echo [错误] 找不到 Vercel CLI：%VERCEL%
  echo        请先装： npm i -g vercel
  pause
  exit /b 1
)

if not exist "%APPDIR%\package.json" (
  echo [错误] 找不到工程：%APPDIR%
  pause
  exit /b 1
)

cd /d "%APPDIR%"

echo.
echo ============================================================
echo   第 1 步：登录 Vercel
echo ============================================================
echo.
echo   接下来 Vercel 会问几件事，按下面选：
echo     - Log in to Vercel          → 回车（默认）
echo     - 选 Continue with Email    → 或 GitHub / Google，随你
echo     - 它会开浏览器，在浏览器里点授权
echo.
pause
call "%VERCEL%" login
if errorlevel 1 (
  echo.
  echo [错误] 登录失败或取消了。登录成功后再跑一次本脚本。
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   第 2 步：确认登录身份
echo ============================================================
call "%VERCEL%" whoami
echo.

echo ============================================================
echo   第 3 步：部署到生产环境
echo ============================================================
echo.
echo   接下来会问几件事，按下面选：
echo     - Set up and deploy?        → y
echo     - Which scope?              → 选你自己的账号
echo     - Link to existing project? → N（新建一个，别动旧的 lifeflow-app）
echo     - What's your project's name? → lifeflow-v7（或你喜欢的）
echo     - In which directory is your code located? → ./   （直接回车）
echo     - Want to modify these settings? → N
echo.
pause
call "%VERCEL%" --prod
if errorlevel 1 (
  echo.
  echo [错误] 部署失败，看上面的输出。
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   部署完成
echo ============================================================
echo.
echo   上面那行 Production: https://... 就是你的地址。
echo.
echo   挂自己的域名：
echo     1. 打开 https://vercel.com/dashboard
echo     2. 进这个项目 → Settings → Domains
echo     3. 填你的域名 → Add
echo     4. Vercel 会给出 DNS 记录（A 记录或 CNAME），
echo        去你的域名服务商那里照着加
echo     5. 等 DNS 生效（几分钟到几小时），Vercel 会自动签 HTTPS
echo.
echo   ⚠ 重要：部署到域名之后，三台设备各有各的本地数据。
echo     要让它们共用一份数据，必须先做「跨设备同步」（Supabase）。
echo     那一步需要你的 Supabase URL 与 anon key。
echo.
pause
