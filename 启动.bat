@echo off
chcp 65001 >nul
title Zero Podcast - 启动器

echo ========================================
echo    Zero Podcast 一键启动
echo ========================================
echo.

REM 检查 node 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 Python 是否安装（视频转写需要）
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] 未检测到 Python，视频转写功能（抖音/B站）将不可用
    echo         文字和网页链接解析不受影响
    echo.
) else (
    REM 检查 ffmpeg 是否可用（视频转写需要）
    python -c "import imageio_ffmpeg; imageio_ffmpeg.get_ffmpeg_exe()" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [警告] ffmpeg 未正确安装，视频转写功能（抖音/B站）将不可用
        echo         修复方法: pip install --force-reinstall imageio-ffmpeg
        echo.
    )
)

REM 检查依赖是否安装
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo [成功] 依赖安装完成
    echo.
)

REM 清理占用端口的旧进程
echo [检查] 端口占用情况...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo [清理] 终止占用 3000 端口的进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo [清理] 终止占用 5173 端口的进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
)
timeout /t 1 /nobreak >nul
echo.

REM 启动后端（新窗口）
echo [启动] 后端服务 (端口 3000)...
start "Zero Podcast - 后端" cmd /k "cd /d %~dp0 && npm run server"

REM 等待后端启动
timeout /t 2 /nobreak >nul

REM 启动前端（新窗口）
echo [启动] 前端服务 (端口 5173)...
start "Zero Podcast - 前端" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo    启动完成！
echo    前端地址: http://localhost:5173
echo    后端地址: http://localhost:3000
echo.
echo    关闭两个窗口即可停止服务
echo ========================================
echo.

REM 自动打开浏览器
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

exit /b 0
