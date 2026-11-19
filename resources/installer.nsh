!macro customInstall
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" ollama_exists 0
  IfFileExists "$PROGRAMFILES64\Ollama\ollama.exe" ollama_exists 0

  MessageBox MB_YESNO|MB_ICONQUESTION "Ban co muon tai va cai dat Ollama (chay AI Vision Offline) ngay bay gio khong?$\r$\n$\r$\nLenh cai dat: irm https://ollama.com/install.ps1 | iex" IDNO ollama_skip
    ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm https://ollama.com/install.ps1 | iex"'
    Goto ollama_done

  ollama_exists:
  ollama_skip:
  ollama_done:
!macroend
