@echo off
title Zupply
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-Zupply.ps1"
pause