$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$temp = Join-Path $root '.tmp-test'

New-Item -ItemType Directory -Force $temp | Out-Null
$env:TEMP = $temp
$env:TMP = $temp

Push-Location (Join-Path $root 'backend')
try {
  & $node node_modules\jest\bin\jest.js `
    --runTestsByPath tests\accountingConsistency.test.js `
    --runInBand `
    --no-cache
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
