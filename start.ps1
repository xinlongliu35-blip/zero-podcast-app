Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Zero Podcast Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Check Python and install dependencies
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "[WARN] Python not found. Video transcription (Douyin/Bilibili) unavailable." -ForegroundColor Yellow
    Write-Host "       Text and web link parsing still works."
    Write-Host ""
} else {
    Write-Host "[CHECK] Python dependencies..." -ForegroundColor Gray
    try {
        python -c "import yt_dlp, faster_whisper, imageio_ffmpeg" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Python dependencies ready." -ForegroundColor Green
        } else {
            Write-Host "[INSTALL] Installing Python dependencies (may take a few minutes)..." -ForegroundColor Yellow
            pip install -r requirements.txt
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Python dependencies installed." -ForegroundColor Green
            } else {
                Write-Host "[WARN] Python dependency install failed." -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "[WARN] Python check failed." -ForegroundColor Yellow
    }
    Write-Host ""
}

# 3. Check Node dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[INSTALL] Installing Node dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Node dependency install failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Node dependencies installed." -ForegroundColor Green
    Write-Host ""
}

# 4. Clean up ports
Write-Host "[CHECK] Cleaning up ports..." -ForegroundColor Gray
$ports = @(3000, 5173)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        Write-Host "[CLEAN] Killing process on port $port, PID: $($conn.OwningProcess)" -ForegroundColor Yellow
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1
Write-Host ""

# 5. Start backend
Write-Host "[START] Backend (port 3000)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k", "cd /d `"$PWD`" && npm run server" -WindowStyle Normal

Start-Sleep -Seconds 2

# 6. Start frontend
Write-Host "[START] Frontend (port 5173)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k", "cd /d `"$PWD`" && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Started successfully!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173"
Write-Host "   Backend:  http://localhost:3000"
Write-Host ""
Write-Host "   Close the two new windows to stop."
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "You can close this window now." -ForegroundColor Gray
Read-Host "Press Enter to close this window"
