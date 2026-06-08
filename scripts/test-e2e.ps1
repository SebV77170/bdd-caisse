$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$electron = Join-Path $root 'electron-app\node_modules\electron\dist\electron.exe'
$buildScript = Join-Path $root 'frontend\node_modules\react-scripts\scripts\build.js'
$seedScript = Join-Path $root 'scripts\e2e\seed-production-db.js'
$runner = Join-Path $root 'scripts\e2e\electron-production.e2e.js'
$runtimeRoot = Join-Path $root '.e2e-runtime'
$successMarker = Join-Path $runtimeRoot 'e2e-success'

foreach ($required in @($node, $electron, $buildScript, $seedScript, $runner)) {
  if (-not (Test-Path -LiteralPath $required)) {
    Write-Error "Dépendance E2E manquante : $required"
    exit 1
  }
}

$previousCi = $env:CI
$previousRuntimeRoot = $env:BDD_CAISSE_E2E_ROOT
$exitCode = 0

try {
  $env:CI = 'true'
  $env:BDD_CAISSE_E2E_ROOT = $runtimeRoot

  Write-Host 'Construction du frontend de production...'
  Push-Location (Join-Path $root 'frontend')
  try {
    & $node $buildScript
    if ($LASTEXITCODE -ne 0) {
      throw "La construction du frontend a échoué avec le code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }

  Write-Host 'Exécution du parcours Electron de production...'
  $electronProcess = Start-Process `
    -FilePath $electron `
    -ArgumentList "`"$runner`"" `
    -WindowStyle Hidden `
    -Wait `
    -PassThru
  if ($electronProcess.ExitCode -ne 0) {
    throw "Electron a quitté avec le code $($electronProcess.ExitCode)."
  }
  if (-not (Test-Path -LiteralPath $successMarker)) {
    $logPath = Join-Path $runtimeRoot 'e2e.log'
    if (Test-Path -LiteralPath $logPath) {
      Get-Content -LiteralPath $logPath
    }
    throw 'Le parcours Electron ne s’est pas terminé avec succès.'
  }

  Write-Host 'Parcours Electron de production validé.'
}
catch {
  Write-Host $_ -ForegroundColor Red
  $exitCode = 1
}
finally {
  $env:CI = $previousCi
  $env:BDD_CAISSE_E2E_ROOT = $previousRuntimeRoot

}

exit $exitCode
