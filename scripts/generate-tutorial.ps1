param(
  [ValidateSet('standard', 'menus')]
  [string]$Tutorial = 'standard'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root 'electron-app\vendor\node.exe'
$electron = Join-Path $root 'electron-app\node_modules\electron\dist\electron.exe'
$buildScript = Join-Path $root 'frontend\node_modules\react-scripts\scripts\build.js'
$runnerName = if ($Tutorial -eq 'menus') {
  'generate-menus-tutorial.js'
} else {
  'generate-standard-tutorial.js'
}
$runner = Join-Path $root "scripts\tutorial\$runnerName"
$runtimeRoot = Join-Path $root '.tutorial-runtime'
$stdoutLog = Join-Path $runtimeRoot 'electron-stdout.log'
$stderrLog = Join-Path $runtimeRoot 'electron-stderr.log'

foreach ($required in @($node, $electron, $buildScript, $runner)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Dépendance manquante : $required"
  }
}

$previousCi = $env:CI
try {
  $env:CI = 'true'

  Write-Host 'Construction du frontend...'
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

  Write-Host 'Génération des captures annotées...'
  New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
  Remove-Item -LiteralPath $stdoutLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrLog -Force -ErrorAction SilentlyContinue
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $electron
  $startInfo.Arguments = "`"$runner`""
  $startInfo.WorkingDirectory = $root
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void] $process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  Set-Content -LiteralPath $stdoutLog -Value $stdout -Encoding UTF8
  Set-Content -LiteralPath $stderrLog -Value $stderr -Encoding UTF8

  if ($process.ExitCode -ne 0) {
    if (Test-Path -LiteralPath $stdoutLog) {
      Get-Content -LiteralPath $stdoutLog
    }
    if (Test-Path -LiteralPath $stderrLog) {
      Get-Content -LiteralPath $stderrLog
    }
    $tutorialLog = Join-Path $runtimeRoot 'tutorial.log'
    if (Test-Path -LiteralPath $tutorialLog) {
      Get-Content -LiteralPath $tutorialLog
    }
    throw "La génération du tutoriel a échoué avec le code $($process.ExitCode)."
  }

  $outputFolder = if ($Tutorial -eq 'menus') {
    'presentation-menus'
  } else {
    'parcours-standard'
  }
  Write-Host "Tutoriel disponible dans tutorial-output\$outputFolder\index.html"
}
finally {
  $env:CI = $previousCi
}
