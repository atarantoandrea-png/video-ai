@echo off
chcp 65001 >/dev/null
echo Installo le skill /reel-ai e /reel-ai2 per Claude Code...
echo.
set "DEST=%USERPROFILE%\.claude\skills"
if not exist "%DEST%" mkdir "%DEST%"
set "ZIP=%TEMP%\reel-ai-skill.zip"
curl -fsSL "https://atarantoandrea-png.github.io/video-ai/reel-ai-skill.zip" -o "%ZIP%"
if errorlevel 1 ( echo Errore di download. Controlla la connessione internet. & pause & exit /b 1 )
tar -xf "%ZIP%" -C "%DEST%"
del "%ZIP%" >/dev/null 2>&1
echo.
echo  Fatto! Skill installate in: %DEST%
echo  Ora CHIUDI e RIAPRI Claude Code.
explorer "%DEST%"
pause
