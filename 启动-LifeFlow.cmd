@echo off
chcp 65001 >nul
setlocal
title LifeFlow 启动器

set "APPDIR=C:\还原自备份\hankkk\lifeflow-unified\app-v2"
set "PORT=3210"

echo ============================================================
echo   LifeFlow v7 启动器
echo ============================================================
echo.
echo   工程目录 : %APPDIR%
echo   端口     : %PORT%
echo.

if not exist "%APPDIR%\package.json" (
  echo [错误] 找不到工程：%APPDIR%
  echo        请确认这个文件没被移动或删除。
  pause
  exit /b 1
)

cd /d "%APPDIR%"

echo [1/4] 检查是否已有服务在跑...
powershell -NoProfile -Command ^
  "$c = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('      占用中 PID=' + $c.OwningProcess + ' —— 先停掉它'); Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 } else { Write-Host '      端口空闲' }"

echo.
echo [2/4] 检查构建产物...
if not exist "%APPDIR%\.next\BUILD_ID" (
  echo      没有构建产物，先构建（约 1 分钟）...
  call npm run build
  if errorlevel 1 (
    echo [错误] 构建失败，看上面的输出。
    pause
    exit /b 1
  )
) else (
  echo      已有构建产物
)

echo.
echo [3/4] 取本机局域网地址...
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command ^
  "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -ExpandProperty IPAddress) -join ','"`) do set "IPS=%%i"

echo.
echo ============================================================
echo   服务地址（在对应设备上打开）
echo ============================================================
echo.
echo   电脑   http://localhost:%PORT%
for %%a in (%IPS%) do (
  echo   iPad   http://%%a:%PORT%
  echo   手机   http://%%a:%PORT%
)
echo.
echo   ⚠ iPad 必须「分享 → 添加到主屏幕」再打开。
echo     不加主屏的话，Safari 会在 7 天不活跃后清掉本地数据。
echo.
echo   关掉这个窗口 = 停止服务。
echo ============================================================
echo.

echo [4/4] 启动服务...
echo.
call npm run start -- --hostname 0.0.0.0 --port %PORT%

echo.
echo 服务已退出。
pause
