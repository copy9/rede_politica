@echo off
REM Mantem esta pasta sempre igual ao GitHub: baixa as alteracoes a cada 30 segundos.
REM Deixe esta janela aberta enquanto desenvolve. Para parar, feche a janela ou aperte Ctrl+C.
cd /d "%~dp0"
title Rede Politica - sincronizando com o GitHub
:loop
echo [%time%] Buscando atualizacoes...
git pull --ff-only || (git checkout -- package-lock.json & git pull --ff-only)
timeout /t 30 /nobreak >nul
goto loop
