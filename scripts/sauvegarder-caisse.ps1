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
$destination = $args[0]

Push-Location $root
try {
  if ($destination) {
    & $node $script backup $destination
  }
  else {
    & $node $script backup
  }
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
