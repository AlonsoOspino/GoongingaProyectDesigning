param(
  [string]$TargetUrl,
  [string]$DumpFile,
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

if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
  $TargetUrl = Read-RequiredValue "Paste NEW Neon direct connection string"
}

Test-NotPooler "TargetUrl" $TargetUrl

$pgRestore = Join-Path $PostgresBin "pg_restore.exe"
if (!(Test-Path -LiteralPath $pgRestore)) {
  throw "pg_restore.exe not found at $pgRestore"
}

$backupDir = Join-Path $PSScriptRoot "backups"

if ([string]::IsNullOrWhiteSpace($DumpFile)) {
  $latestBackup = Get-ChildItem -LiteralPath $backupDir -Filter "*.dump" -File |
    Where-Object { $_.Length -gt 0 } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (!$latestBackup) {
    throw "No non-empty .dump backup files found in $backupDir"
  }

  $DumpFile = $latestBackup.FullName
}

if (!(Test-Path -LiteralPath $DumpFile)) {
  throw "Dump file not found: $DumpFile"
}

$dumpInfo = Get-Item -LiteralPath $DumpFile
if ($dumpInfo.Length -le 0) {
  throw "Dump file is empty: $DumpFile"
}

Write-Host ""
Write-Host "Restoring backup:"
Write-Host $DumpFile
Write-Host ""

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

$restoreArgs += $DumpFile

& $pgRestore @restoreArgs

if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Done. Backup restored successfully."
Write-Host "Now update DATABASE_URL and DIRECT_URL in your backend/host to this NEW Neon URL."
