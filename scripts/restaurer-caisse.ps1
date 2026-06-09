param(
  [Parameter(Mandatory = $true)]
  [string]$Sauvegarde
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeCandidates = @(
  (Join-Path $root 'electron-app\vendor\node.exe'),
  (Join-Path $root 'node.exe')
)
$node = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $node) {
  throw 'Runtime Node de Bdd-caisse introuvable.'
}
$script = Join-Path $PSScriptRoot 'profile-backup.js'

Write-Host "Fermez complètement Bdd-caisse avant de continuer." -ForegroundColor Yellow
$confirmation = Read-Host "Tapez RESTAURER pour remplacer le profil local"
if ($confirmation -ne 'RESTAURER') {
  Write-Host 'Restauration annulée.'
  exit 1
}

Push-Location $root
try {
  & $node $script verify $Sauvegarde
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $node $script restore $Sauvegarde
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
