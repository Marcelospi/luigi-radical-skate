@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Luigi Radical Skate - Servidor Local

cd /d "%~dp0"

set "PORTA=8000"
set "PY_CMD="

:: Detecta Python real (evita o atalho vazio da Microsoft Store)
python -c "import http.server" >nul 2>nul
if %errorlevel%==0 (
    set "PY_CMD=python"
) else (
    py -3 -c "import http.server" >nul 2>nul
    if !errorlevel!==0 (
        set "PY_CMD=py -3"
    ) else (
        py -c "import http.server" >nul 2>nul
        if !errorlevel!==0 set "PY_CMD=py"
    )
)

if "%PY_CMD%"=="" (
    echo.
    echo ============================================================
    echo   LUIGI RADICAL SKATE - Python não encontrado
    echo ============================================================
    echo.
    echo   Para rodar o jogo localmente, instale o Python gratuito em:
    echo   https://www.python.org/downloads/
    echo.
    echo   Durante a instalação, marque a opção "Add Python to PATH".
    echo ============================================================
    echo.
    pause
    exit /b 1
)

:: Tenta descobrir o IP local da rede Wi-Fi (opcional, para jogar no celular)
set "IP_LOCAL="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    if not defined IP_LOCAL (
        for /f "tokens=1" %%b in ("%%a") do set "IP_LOCAL=%%b"
    )
)

cls
echo.
echo ============================================================
echo   🛹 LUIGI RADICAL SKATE
echo ============================================================
echo.
echo   Servidor rodando! O navegador vai abrir automaticamente.
echo.
echo   No computador:  http://localhost:%PORTA%
if defined IP_LOCAL (
    echo   No celular:     http://%IP_LOCAL%:%PORTA%  ^(mesmo Wi-Fi^)
)
echo.
echo   Mantenha esta janela aberta enquanto joga.
echo   Quando terminar, basta fechar esta janela.
echo ============================================================
echo.

:: Abre o navegador 1 segundo depois para garantir que a porta ja esteja ativa
start "" /b cmd /c "timeout /t 1 /nobreak >nul && start "" http://localhost:%PORTA%"

:: Inicia o servidor HTTP local na pasta do jogo
%PY_CMD% -m http.server %PORTA%

echo.
echo   Servidor encerrado.
pause
