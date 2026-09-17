@echo off
chcp 65001 >nul
title Zero Podcast - 停止服务

echo ========================================
echo    Zero Podcast 停止服务
echo ========================================
echo.

REM 终止占用 3000 和 5173 端口的进程
echo [停止] 正在终止后端和前端服务...

set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo [停止] 终止后端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
    set found=1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo [停止] 终止前端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
    set found=1
)

if "%found%"=="0" (
    echo [信息] 未检测到运行中的服务
) else (
    echo.
    echo [完成] 服务已停止
)

echo.
timeout /t 2 /nobreak >nul
exit /b 0
