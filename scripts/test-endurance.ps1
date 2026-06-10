$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$runner = Join-Path $root 'scripts\endurance-runner.js'
$temp = Join-Path $root '.tmp-endurance'
$arguments = @($runner) + $args

if (-not (Test-Path -LiteralPath $node)) {
  Write-Error "Runtime Node embarque introuvable : $node"
  exit 1
}

$previousDataDir = $env:BDD_CAISSE_DATA_DIR
$exitCode = 1

try {
  $env:BDD_CAISSE_DATA_DIR = $temp
  New-Item -ItemType Directory -Force $temp | Out-Null
  & $node @arguments
  $exitCode = $LASTEXITCODE
}
finally {
  $env:BDD_CAISSE_DATA_DIR = $previousDataDir
  if (Test-Path -LiteralPath $temp) {
    $resolved = (Resolve-Path -LiteralPath $temp).Path
    $expected = [System.IO.Path]::GetFullPath($temp)
    if ($resolved -ne $expected) {
      throw "Chemin temporaire inattendu : $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}

exit $exitCode
