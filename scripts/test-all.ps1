$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$runner = Join-Path $PSScriptRoot 'test-all.js'

$requiredFiles = @{
  'runtime Node embarque' = $node
  'orchestrateur de tests' = $runner
}

foreach ($dependency in $requiredFiles.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $dependency.Value)) {
    Write-Error "Dependance manquante ($($dependency.Key)) : $($dependency.Value)"
    exit 1
  }
}

& $node $runner
exit $LASTEXITCODE
