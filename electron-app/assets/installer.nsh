!macro customCheckAppRunning
  DetailPrint "Fermeture forcée de l'application avant installation..."
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  DetailPrint "Fermeture des anciens serveurs internes Bdd-caisse..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name=''node.exe''\" | Where-Object CommandLine -Like ''*resources\backend\index.js*'' | Invoke-CimMethod -MethodName Terminate"'
  Sleep 1500
!macroend
