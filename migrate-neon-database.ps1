param(
  [string]$SourceUrl,
  [string]$TargetUrl,
  [string]$PostgresBin = "C:\Program Files\PostgreSQL\18\bin",
  [switch]$CleanTarget
)

$ErrorActionPreference = "Stop"

function Read-RequiredValue($PromptText) {
  $value = Read-Host $PromptText
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $PromptText"
  }
  return $value.Trim()
}

function Test-NotPooler($Label, $Url) {
  if ($Url -match "-pooler\.") {
    throw "$Label appears to be a pooled Neon URL. Use the direct/unpooled connection string instead."
  }
}

if ([string]::IsNullOrWhiteSpace($SourceUrl)) {
  $SourceUrl = Read-RequiredValue "Paste OLD Neon direct connection string"
}

if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
  $TargetUrl = Read-RequiredValue "Paste NEW Neon direct connection string"
}

Test-NotPooler "SourceUrl" $SourceUrl
Test-NotPooler "TargetUrl" $TargetUrl

$pgDump = Join-Path $PostgresBin "pg_dump.exe"
$pgRestore = Join-Path $PostgresBin "pg_restore.exe"

if (!(Test-Path -LiteralPath $pgDump)) {
  throw "pg_dump.exe not found at $pgDump"
}

if (!(Test-Path -LiteralPath $pgRestore)) {
  throw "pg_restore.exe not found at $pgRestore"
}

$backupDir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpFile = Join-Path $backupDir "neon-migration-$timestamp.dump"

Write-Host ""
Write-Host "Step 1/2: Backing up old Neon database..."
& $pgDump -Fc -v -d $SourceUrl -f $dumpFile

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Backup created: $dumpFile"
Write-Host "Step 2/2: Restoring into new Neon database..."

$restoreArgs = @(
  "-v",
  "-O",
  "-x",
  "--no-tablespaces",
  "--single-transaction",
  "-d",
  $TargetUrl
)

if ($CleanTarget) {
  $restoreArgs = @("-c", "--if-exists") + $restoreArgs
}

$restoreArgs += $dumpFile

& $pgRestore @restoreArgs

if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Done. Database migrated successfully."
Write-Host "Now update DATABASE_URL and DIRECT_URL in your backend/host to the NEW Neon URL."
