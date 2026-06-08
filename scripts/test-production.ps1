$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$unitRunner = Join-Path $PSScriptRoot 'test-all.ps1'
$e2eRunner = Join-Path $PSScriptRoot 'test-e2e.ps1'

Push-Location $root
try {
  Write-Host '=== Tests backend et frontend ==='
  & $unitRunner
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host ''
  Write-Host '=== Parcours Electron de production ==='
  & $e2eRunner
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
