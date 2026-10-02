param([switch]$ImportLegacyDrafts)
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
$springRoot = Join-Path (Split-Path -Parent $projectRoot) "backend-springboot"
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { (Get-Command java -ErrorAction Stop).Source }
$jar = Join-Path $springRoot "target\backend-springboot-0.0.1-SNAPSHOT.jar"
$localEnv = Join-Path $springRoot ".env"
if (-not (Test-Path -LiteralPath $localEnv)) { $localEnv = Join-Path $projectRoot "backend\.env.local" }
if (Test-Path -LiteralPath $localEnv) {
  foreach ($line in Get-Content -LiteralPath $localEnv) {
    if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim([char[]]@([char]34, [char]39)), 'Process')
    }
  }
}
if (-not $env:SPRING_DATASOURCE_URL -and $env:DATABASE_URL) {
  $databaseUri = [Uri]$env:DATABASE_URL
  $credentials = $databaseUri.UserInfo.Split(':', 2)
  $databasePort = if ($databaseUri.Port -gt 0) { $databaseUri.Port } else { 5432 }
  $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://$($databaseUri.Host):$databasePort$($databaseUri.AbsolutePath)"
  $env:SPRING_DATASOURCE_USERNAME = [Uri]::UnescapeDataString($credentials[0])
  $env:SPRING_DATASOURCE_PASSWORD = [Uri]::UnescapeDataString($credentials[1])
}
if (-not $env:SPRING_DATASOURCE_URL) { throw "Configure backend-springboot/.env from .env.example or retain backend/.env.local for the development database." }
$env:PORT = '3100'
$env:DRAFT_CORS_ORIGINS = 'http://localhost:3001,http://localhost:3002'
$env:MEDIA_DIR = Join-Path $projectRoot 'media'

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
  Push-Location $springRoot
  try {
    & .\mvnw.cmd -B -DskipTests package
    if ($LASTEXITCODE -ne 0) { throw "Java compilation failed. Configure JDK 21 in JAVA_HOME." }
    if ($ImportLegacyDrafts) {
      & $java -jar $jar --migration.mode=apply --server.port=0 --draft.timeouts-enabled=false --feud.timeouts-enabled=false --notifications.enabled=false
      if ($LASTEXITCODE -ne 0) { throw "Draft import failed; review the report above." }
    }
  } finally { Pop-Location }
  Start-Process -FilePath $java `
    -ArgumentList @('-jar', ('"' + $jar + '"')) `
    -WorkingDirectory $springRoot `
    -RedirectStandardOutput (Join-Path $runtimeDir "backend.out.log") `
    -RedirectStandardError (Join-Path $runtimeDir "backend.err.log") `
    -WindowStyle Hidden
}

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $health = Invoke-RestMethod 'http://localhost:3100/health' -TimeoutSec 2
    if ($health.runtime -ne 'spring-boot') { throw "Port 3100 is occupied by another backend." }
    $null = Invoke-RestMethod 'http://localhost:3100/health/db' -TimeoutSec 2
    $healthy = $true
    break
  } catch { Start-Sleep -Seconds 2 }
}
if (-not $healthy) { throw "Spring did not become healthy. Review .local-dev/backend.err.log and backend.out.log. Import an existing draft database using -ImportLegacyDrafts." }

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
