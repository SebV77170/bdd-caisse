$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$jest = Join-Path $root 'backend\node_modules\jest\bin\jest.js'
$tempDir = Join-Path $root '.tmp-test'

New-Item -ItemType Directory -Force $tempDir | Out-Null
$previousTemp = $env:TEMP
$previousTmp = $env:TMP
$env:TEMP = $tempDir
$env:TMP = $tempDir

$exitCode = 1
Push-Location (Join-Path $root 'backend')
try {
  & $node $jest `
    --runTestsByPath `
    tests\databaseLifecycle.test.js `
    tests\historicalMigrations.test.js `
    tests\packagingConfiguration.test.js `
    tests\releaseInfo.test.js `
    tests\updateStartupPolicy.test.js `
    --runInBand `
    --no-cache
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
  $env:TEMP = $previousTemp
  $env:TMP = $previousTmp
  if (Test-Path -LiteralPath $tempDir) {
    $resolvedTemp = [System.IO.Path]::GetFullPath($tempDir)
    $resolvedRoot = [System.IO.Path]::GetFullPath($root) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolvedTemp.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Chemin temporaire inattendu : $resolvedTemp"
    }
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}

exit $exitCode
