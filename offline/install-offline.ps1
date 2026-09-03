# OpenViking 离线安装(Windows)
# 用法: .\install-offline.ps1 <wheels目录> [目标venv目录]
param(
  [Parameter(Mandatory=$true)][string]$WheelsDir,
  [string]$VenvDir = "$env:LOCALAPPDATA\openviking-venv"
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Join-Path $WheelsDir 'openviking-0.4.17.1-cp310-abi3-win_amd64.whl'))) {
  Write-Host "[ERR] 未在 $WheelsDir 找到 openviking wheel,请检查路径" -ForegroundColor Red
  exit 1
}

# 找一个可用 Python 3.10+
$py = $null
foreach ($cand in @('python','py')) {
  $cmd = Get-Command $cand -ErrorAction SilentlyContinue
  if ($cmd) {
    $v = & $cmd.Source -c "import sys;print(sys.version_info[:2])" 2>$null
    if ($v -match '\(3, 1[0-9]\)') { $py = $cmd.Source; break }
  }
}
if (-not $py) { Write-Host "[ERR] 需要 Python 3.10+(未找到)" -ForegroundColor Red; exit 1 }

Write-Host "[1/3] 创建 venv: $VenvDir"
& $py -m venv $VenvDir
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[2/3] 离线安装 openviking(本地 wheel,不联网)"
& "$VenvDir\Scripts\python.exe" -m pip install --no-index --find-links $WheelsDir openviking
if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] 安装失败" -ForegroundColor Red; exit 1 }

Write-Host "[3/3] 校验"
$ovExe = "$VenvDir\Scripts\openviking.exe"
$srvExe = "$VenvDir\Scripts\openviking-server.exe"
& $ovExe --version
if (-not (Test-Path $srvExe)) { Write-Host "[ERR] openviking-server 缺失" -ForegroundColor Red; exit 1 }

Write-Host "`n完成。启动服务端:" -ForegroundColor Green
Write-Host "  $srvExe" -ForegroundColor Cyan
Write-Host "配置: 复制 ov.conf.example 到 ~/.openviking/ov.conf 后填写。" -ForegroundColor Cyan
