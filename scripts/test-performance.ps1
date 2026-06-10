$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$jest = Join-Path $root 'backend\node_modules\jest\bin\jest.js'
$temp = Join-Path $root '.tmp-performance'

New-Item -ItemType Directory -Force $temp | Out-Null
$previousNodeEnv = $env:NODE_ENV
$previousTemp = $env:TEMP
$previousTmp = $env:TMP

try {
  $env:NODE_ENV = 'test'
  $env:TEMP = $temp
  $env:TMP = $temp

  $exitCode = 1
  Push-Location (Join-Path $root 'backend')
  try {
    & $node $jest --runInBand --no-cache --runTestsByPath .\tests\performanceEndurance.test.js
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }
}
finally {
  $env:NODE_ENV = $previousNodeEnv
  $env:TEMP = $previousTemp
  $env:TMP = $previousTmp
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}

exit $exitCode
