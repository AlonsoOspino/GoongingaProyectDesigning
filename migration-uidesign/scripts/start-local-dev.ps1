$ErrorActionPreference = "Stop"

$processEnvironment = [System.Environment]::GetEnvironmentVariables()
$pathKeys = @($processEnvironment.Keys | Where-Object { $_ -imatch '^path$' })
if ($pathKeys.Count -gt 1) {
  $pathValue = $processEnvironment["Path"]
  [System.Environment]::SetEnvironmentVariable("PATH", $null, [System.EnvironmentVariableTarget]::Process)
  [System.Environment]::SetEnvironmentVariable("Path", $pathValue, [System.EnvironmentVariableTarget]::Process)
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$postgresRoot = Join-Path $projectRoot ".local-postgres"
$postgresData = Join-Path $postgresRoot "data"
$postgresLog = Join-Path $postgresRoot "postgres.log"
$runtimeDir = Join-Path $projectRoot ".local-dev"
$pgCtl = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
$pgIsReady = "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe"
$node = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path -LiteralPath $postgresData)) {
  throw "Local PostgreSQL data is missing. Restore the Season 8 development database first."
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$null = & $pgIsReady -h 127.0.0.1 -p 55432 -d goonginga_dev
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $postgresData -l $postgresLog -o "-p 55432 -h 127.0.0.1" start | Out-Null
}

$backendReady = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
if (-not $backendReady) {
  Start-Process -FilePath $node `
    -ArgumentList @("-r", "dotenv/config", "app.js", "dotenv_config_path=.env.local") `
    -WorkingDirectory (Join-Path $projectRoot "backend") `
    -RedirectStandardOutput (Join-Path $runtimeDir "backend.out.log") `
    -RedirectStandardError (Join-Path $runtimeDir "backend.err.log") `
    -WindowStyle Hidden
}

$frontendReady = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $frontendReady) {
  Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" `
    -ArgumentList @("run", "dev", "--", "-p", "3001") `
    -WorkingDirectory (Join-Path $projectRoot "frontend") `
    -RedirectStandardOutput (Join-Path $runtimeDir "frontend.out.log") `
    -RedirectStandardError (Join-Path $runtimeDir "frontend.err.log") `
    -WindowStyle Hidden
}

Write-Host "Backend:  http://localhost:3100"
Write-Host "Frontend: http://localhost:3001"
Write-Host "Postgres: 127.0.0.1:55432/goonginga_dev"
