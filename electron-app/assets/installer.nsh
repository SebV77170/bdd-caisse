!macro customCheckAppRunning
  DetailPrint "Fermeture forcée de l'application avant installation..."
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1500
!macroend
