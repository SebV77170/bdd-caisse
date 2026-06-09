$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$jest = Join-Path $root 'backend\node_modules\jest\bin\jest.js'
$tempDir = Join-Path $root '.tmp-test'

New-Item -ItemType Directory -Force $tempDir | Out-Null
$env:TEMP = $tempDir
$env:TMP = $tempDir

Push-Location (Join-Path $root 'backend')
try {
  & $node $jest `
    --runTestsByPath `
    tests\databaseLifecycle.test.js `
    tests\historicalMigrations.test.js `
    tests\packagingConfiguration.test.js `
    tests\updateStartupPolicy.test.js `
    --runInBand `
    --no-cache
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
