@echo off
REM Clique duas vezes neste arquivo para abrir o app e manter tudo atualizado.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1"
pause
