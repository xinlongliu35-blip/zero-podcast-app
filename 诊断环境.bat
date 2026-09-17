@echo off
chcp 65001 >nul
title Zero Podcast - 环境诊断

echo ========================================
echo    Zero Podcast 环境诊断
echo ========================================
echo.

echo [1/4] 检查 Node.js...
where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version') do echo    Node.js: %%v ✓
) else (
    echo    Node.js: 未安装 ✗
)
echo.

echo [2/4] 检查 Python...
where python >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo    Python: %%v ✓
) else (
    echo    Python: 未安装 ✗（视频转写不可用）
)
echo.

echo [3/4] 检查 Python 依赖...
if %errorlevel% equ 0 (
    python -c "import yt_dlp; print('   yt-dlp:', yt_dlp.version.__version__, '✓')" 2>nul
    if %errorlevel% neq 0 echo    yt-dlp: 未安装 ✗

    python -c "import faster_whisper; print('   faster-whisper: 已安装 ✓')" 2>nul
    if %errorlevel% neq 0 echo    faster-whisper: 未安装 ✗

    python -c "import imageio_ffmpeg; print('   imageio-ffmpeg: 已安装 ✓')" 2>nul
    if %errorlevel% neq 0 echo    imageio-ffmpeg: 未安装 ✗

    python -c "import selenium; print('   selenium: 已安装 ✓')" 2>nul
    if %errorlevel% neq 0 echo    selenium: 未安装
)
echo.

echo [4/4] 检查 ffmpeg（视频转写核心依赖）...
python -c "import imageio_ffmpeg; exe=imageio_ffmpeg.get_ffmpeg_exe(); import os; print('   ffmpeg路径:', exe); print('   文件存在:', os.path.isfile(exe))" 2>nul
if %errorlevel% neq 0 (
    echo    ffmpeg: 不可用 ✗
    echo.
    echo    [修复方案] 执行以下命令之一：
    echo      pip install --force-reinstall imageio-ffmpeg
    echo      或下载 ffmpeg 并加入系统 PATH
)
echo.

echo ========================================
echo    诊断完成
echo ========================================
echo.
pause
